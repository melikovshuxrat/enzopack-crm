-- Долги клиентов/поставщиков (5 правок, раздел 4): доставка заказа больше не
-- списывает в доход всю сумму заказа безусловно — теперь досчитывает только
-- остаток за вычетом уже внесённых ручных оплат (category='order_payment'),
-- под отдельной категорией 'order_delivery_settlement', чтобы откат статуса
-- не затирал ручные частичные оплаты. Схема не меняется, только функция.

create or replace function update_order_status(p_order_id uuid, p_new_status text) returns void as $$
declare
  v_order orders%rowtype;
  v_was_ready boolean;
  v_will_be_ready boolean;
  v_paid numeric;
  v_remaining numeric;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;
  if v_order.status = p_new_status then
    return;
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'Order % is cancelled and cannot be changed', p_order_id;
  end if;

  if p_new_status = 'cancelled' then
    update raw_materials rm
      set stock_qty = rm.stock_qty + omc.qty_consumed
      from order_material_consumption omc
      where omc.order_id = p_order_id and omc.raw_material_id = rm.id and omc.applied = true;

    if v_order.status = 'ready' then
      update finished_products set stock_qty = stock_qty - v_order.quantity where id = v_order.product_id;

      insert into finished_goods_movements (product_id, order_id, movement_type, qty, movement_date, notes)
        values (v_order.product_id, p_order_id, 'adjustment', -v_order.quantity, now(), 'Отмена заказа после статуса «Готово»');
    end if;
  else
    if v_order.status = 'processing' and p_new_status = 'in_progress' then
      update raw_materials rm
        set stock_qty = rm.stock_qty - omc.qty_consumed
        from order_material_consumption omc
        where omc.order_id = p_order_id and omc.raw_material_id = rm.id and omc.applied = false;

      update order_material_consumption
        set applied = true
        where order_id = p_order_id and applied = false;
    end if;

    v_was_ready := (v_order.status = 'ready');
    v_will_be_ready := (p_new_status = 'ready');

    if v_was_ready and not v_will_be_ready then
      update finished_products set stock_qty = stock_qty - v_order.quantity where id = v_order.product_id;

      insert into finished_goods_movements (product_id, order_id, movement_type, qty, movement_date, notes)
        values (v_order.product_id, p_order_id, 'shipped', v_order.quantity, now(), 'Статус: ' || p_new_status);
    elsif not v_was_ready and v_will_be_ready then
      update finished_products set stock_qty = stock_qty + v_order.quantity where id = v_order.product_id;

      insert into finished_goods_movements (product_id, order_id, movement_type, qty, movement_date, notes)
        values (v_order.product_id, p_order_id, 'produced', v_order.quantity, now(), 'Статус: ready');
    end if;
  end if;

  if p_new_status = 'delivered' and v_order.status != 'delivered' then
    select coalesce(sum(amount), 0) into v_paid
      from finance_transactions
      where related_order_id = p_order_id and type = 'income';

    v_remaining := v_order.total_amount - v_paid;

    if v_remaining > 0 then
      insert into finance_transactions (type, category, amount, related_order_id, related_client_id, description, transaction_date)
      values ('income', 'order_delivery_settlement', v_remaining, p_order_id, v_order.client_id, null, current_date);
    end if;
  elsif v_order.status = 'delivered' and p_new_status != 'delivered' then
    delete from finance_transactions
      where related_order_id = p_order_id and category = 'order_delivery_settlement';
  end if;

  update orders set status = p_new_status where id = p_order_id;
end;
$$ language plpgsql security definer;
