-- Day-by-day timesheet for employees ("Сотрудники"), instead of a single
-- monthly hours number. The existing employee_hours (monthly aggregate,
-- used for salary calc) is left completely untouched in shape — a trigger
-- keeps it in sync automatically whenever a daily row changes, so nothing
-- that already reads employee_hours needs to change.

create table employee_daily_hours (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  hours numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index idx_edh_employee_date on employee_daily_hours(employee_id, work_date);

create trigger trg_employee_daily_hours_updated before update on employee_daily_hours
  for each row execute function set_updated_at();

create or replace function sync_employee_hours_from_daily() returns trigger as $$
declare
  v_employee_id uuid := coalesce(new.employee_id, old.employee_id);
  v_month date := date_trunc('month', coalesce(new.work_date, old.work_date))::date;
  v_total numeric;
  v_salary numeric;
  v_norm numeric;
begin
  -- A cascade-delete of the parent employee (on delete cascade from
  -- employees -> employee_daily_hours) fires this trigger for each removed
  -- row; the employee is gone by then, so there's nothing to resync (its
  -- employee_hours rows cascade-delete on their own via the same FK).
  if not exists (select 1 from employees where id = v_employee_id) then
    return coalesce(new, old);
  end if;

  select coalesce(sum(hours), 0) into v_total
    from employee_daily_hours
    where employee_id = v_employee_id and date_trunc('month', work_date) = v_month;

  select monthly_salary, monthly_norm_hours into v_salary, v_norm
    from employees where id = v_employee_id;

  insert into employee_hours (employee_id, month, hours_worked, salary_snapshot, norm_hours_snapshot)
    values (v_employee_id, v_month, v_total, coalesce(v_salary, 0), coalesce(v_norm, 176))
    on conflict (employee_id, month) do update
      set hours_worked = excluded.hours_worked,
          salary_snapshot = excluded.salary_snapshot,
          norm_hours_snapshot = excluded.norm_hours_snapshot;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger trg_sync_employee_hours
  after insert or update or delete on employee_daily_hours
  for each row execute function sync_employee_hours_from_daily();

alter table employee_daily_hours enable row level security;
create policy "public_all_employee_daily_hours" on employee_daily_hours for all using (true) with check (true);
