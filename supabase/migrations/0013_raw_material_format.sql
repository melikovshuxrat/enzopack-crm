-- New free-text "Формат" field on raw materials, shown right before
-- "Граммаж" in the warehouse table — не число, любой текст.
alter table raw_materials add column format text;
