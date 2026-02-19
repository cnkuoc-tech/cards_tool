#!/usr/bin/env python3
"""
移除 JavaScript 檔案中的 console.log，保留 console.error
"""
import re
import sys

def remove_console_logs(content):
    """移除 console.log 語句（包括多行）"""
    # 移除單行 console.log
    content = re.sub(r'^\s*console\.log\([^)]*\);\s*$', '', content, flags=re.MULTILINE)
    
    # 移除多行 console.log（可能跨多行的參數）
    # 使用非貪婪匹配，從 console.log( 到下一個 );
    content = re.sub(r'^\s*console\.log\(.*?\);\s*$', '', content, flags=re.MULTILINE | re.DOTALL)
    
    # 移除多餘的空行（連續超過 2 個空行改為 2 個）
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    return content

def process_file(filepath):
    """處理單個檔案"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_lines = content.count('\n')
        original_console_logs = content.count('console.log')
        
        # 移除 console.log
        new_content = remove_console_logs(content)
        
        new_lines = new_content.count('\n')
        new_console_logs = new_content.count('console.log')
        
        # 寫回檔案
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ {filepath}")
        print(f"   原始行數: {original_lines} → 新行數: {new_lines} (減少 {original_lines - new_lines} 行)")
        print(f"   console.log: {original_console_logs} → {new_console_logs} (移除 {original_console_logs - new_console_logs} 個)")
        print()
        
        return True
    except Exception as e:
        print(f"❌ 處理 {filepath} 失敗: {e}")
        return False

if __name__ == '__main__':
    files = sys.argv[1:]
    if not files:
        print("用法: python3 remove_console_log.py <file1> <file2> ...")
        sys.exit(1)
    
    success_count = 0
    for filepath in files:
        if process_file(filepath):
            success_count += 1
    
    print(f"\n完成! 成功處理 {success_count}/{len(files)} 個檔案")
