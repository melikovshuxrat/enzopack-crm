-- Free-text raw material category (рулон/клей/этикетка/доп. сырьё/...) — no
-- separate lookup table, the filter and form dropdown are simply derived
-- from whatever distinct values already exist.
alter table raw_materials add column category text;
