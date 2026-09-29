-- Splits the employee journal into two tables (regular / управленческий
-- персонал) on the client's request. Additive, default keeps every existing
-- employee as 'regular'.
alter table employees add column staff_type text not null default 'regular'
  check (staff_type in ('regular', 'management'));
