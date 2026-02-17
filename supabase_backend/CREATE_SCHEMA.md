# Supabase 資料表結構建立指南

根據現有資料表欄位，以下是完整的結構文件：

## 📊 資料表結構 (實際存在的欄位)

### 1. users
```
- id (自動)
- phone (主鍵)
- nickname
- birthday  
- email
- address
- real_name
- created_at
- updated_at
- password
```

### 2. orders  
```
- id
- user_id (外鍵 → users.id)
- timestamp
- item
- card_no
- quantity
- total_fee
- balance_amount
- status
- payment_method
- is_notified
- is_cleared
- remark
- created_at
- updated_at
- unit_price
- deposit
- is_invoiced
- is_shipped
- arrival_status
- image_url
- box_order
- merchant_trade_no
- payment_date
- notes
```

### 3. breaks
```
- id
- break_id
- user_id (外鍵)
- name
- category
- format
- item
- total_fee
- paid
- balance
- status
- is_opened
- is_shipped
- is_cleared
- payment_method
- remark
- created_at
- updated_at
- merchant_trade_no
- payment_date
```

### 4. product_catalog
```
- id
- item_name
- card_no
- price
- threshold_price
- discount_threshold
- min_group_quantity
- can_draw_sp
- can_draw_signature
- can_draw_relic
- can_draw_auto_relic
- is_available
- image_url_1
- image_url_2
- image_url_3
- image_url_4
- stock_status
- is_box_preorder
- can_direct_order
- remaining_stock
- description
- ordered_quantity
- scheduled_list_time
- scheduled_delist_time
- is_arrival_notified
- category
- created_at
- updated_at
```

### 5. psa_orders
```
- id
- order_id
- user_id (外鍵)
- real_name
- email
- phone
- shipping_method
- total_cards
- total_amount
- status
- created_at
- updated_at
- price_per_card
- status_updated_at
- timestamp
```

### 6. order_history
```
- id
- user_id (外鍵)
- action
- order_type
- order_id
- item
- amount
- details
- timestamp
```

### 7. break_credits
```
- id
- user_id (外鍵)
- amount
- source
- is_used
- used_break_ids
- used_amount
- created_at
- updated_at
```

### 8. ecpay_records
```
- merchant_trade_no (必填, NOT NULL)
- user_id (外鍵)
- order_number
- amount
- product_name
- status
- payment_time
- return_message
- order_details
- payment_type
- created_at
- updated_at
```

### 9. shipments
```
- id
- user_id (外鍵)
- shipment_date
- tracking_no
- items
- status
- created_at
- updated_at
- shipment_no
- nickname
- real_name
- phone
- ship_store
- store_number
- remark
```

### 10. lottery
```
- id
- user_id (外鍵)
- item
- quantity
- total_fee
- paid
- balance
- status
- payment_method
- is_notified
- is_cleared
- remark
- created_at
- updated_at
```

## 🔑 重要注意事項

1. **大部分資料表使用 `user_id` 外鍵**，需要先查詢用戶的 ID
2. **用戶表使用 `phone` 作為主鍵**
3. **ecpay_records 的 `merchant_trade_no` 是必填欄位**
4. **商品表使用 `item_name` + `card_no` 作為唯一鍵**

## 📝 遷移策略

1. 先遷移 users (建立 phone → user_id 對應表)
2. 遷移 product_catalog
3. 遷移其他資料 (使用 phone 查詢 user_id)
