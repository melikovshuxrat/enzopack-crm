-- Payroll payments (аванс/на руки) and their link into Finance, requested
-- after the client's Zoom call — additive only, nothing existing changes.

create table employee_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  payment_date date not null default current_date,
  type text not null check (type in ('advance', 'payout')),
  amount numeric(12,2) not null check (amount > 0),
  comment text,
  created_at timestamptz not null default now()
);

create index idx_employee_payments_employee_date on employee_payments(employee_id, payment_date);

alter table employee_payments enable row level security;
create policy "public_all_employee_payments" on employee_payments for all using (true) with check (true);

alter table finance_transactions add column related_employee_id uuid references employees(id) on delete set null;
