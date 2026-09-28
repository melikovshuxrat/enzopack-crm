-- "Прошлый долг" — starting balance for clients/suppliers migrating onto the
-- system with existing debt, so it isn't lost. Purely additive; folded into
-- the existing debt calculation as a starting point, nothing else changes.
alter table suppliers add column opening_debt numeric(12,2) not null default 0;
alter table clients add column opening_debt numeric(12,2) not null default 0;
