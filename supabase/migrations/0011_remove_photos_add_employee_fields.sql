-- Client wants a flat Excel-style table view everywhere instead of photo
-- cards, and photos aren't used at all going forward — drop the photo/logo
-- columns outright rather than just hiding them in the UI. Also adds the two
-- employee fields the new "Сотрудники" page needs (position, daily norm
-- hours) alongside the existing monthly_norm_hours.

alter table suppliers drop column if exists photo_url;
alter table raw_materials drop column if exists photo_url;
alter table finished_products drop column if exists photo_url;
alter table dies drop column if exists photo_url;
alter table clients drop column if exists logo_url;

alter table employees add column if not exists position text;
alter table employees add column if not exists daily_norm_hours numeric(6,2) not null default 8;
