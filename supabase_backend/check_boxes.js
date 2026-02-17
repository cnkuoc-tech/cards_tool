import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkBoxes() {
  const { data, error } = await supabase
    .from('product_catalog')
    .select('item_name, is_box_preorder, category')
    .limit(10);
  
  if (error) {
    console.error('❌ 錯誤:', error);
    return;
  }
  
  console.log('前 10 筆商品:');
  data.forEach(p => {
    console.log(`- ${p.item_name}: is_box_preorder=${p.is_box_preorder} (type: ${typeof p.is_box_preorder}), category=${p.category}`);
  });
  
  const boxes = await supabase
    .from('product_catalog')
    .select('item_name, is_box_preorder')
    .eq('is_box_preorder', true);
  
  console.log(`\n找到 ${boxes.data?.length || 0} 筆 is_box_preorder=true 的商品`);
  if (boxes.data && boxes.data.length > 0) {
    boxes.data.slice(0, 5).forEach(b => {
      console.log(`  - ${b.item_name}`);
    });
  }
}

checkBoxes();
