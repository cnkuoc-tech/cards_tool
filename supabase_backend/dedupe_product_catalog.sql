update product_catalog
set item_name = trim(item_name),
    card_no = trim(coalesce(card_no, ''));

with ranked as (
  select id,
         item_name,
         card_no,
         row_number() over (partition by item_name, card_no order by id desc) as rn
  from product_catalog
)
delete from product_catalog
where id in (select id from ranked where rn > 1);

alter table product_catalog
  add constraint product_catalog_item_card_unique
  unique (item_name, card_no);
