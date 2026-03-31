import os
import json
import glob
from collections import defaultdict
from jinja2 import Environment, FileSystemLoader

# --- ディレクトリ設定 ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
DOCS_DIR = os.path.join(BASE_DIR, 'docs')

# 出力先ディレクトリの作成
os.makedirs(os.path.join(DOCS_DIR, 'words'), exist_ok=True)
os.makedirs(os.path.join(DOCS_DIR, 'books'), exist_ok=True)
os.makedirs(os.path.join(DOCS_DIR, 'api', 'books'), exist_ok=True)

def load_data():
    """data/ 以下の全JSONファイルを読み込んで結合する"""
    all_words = []
    for filepath in glob.glob(os.path.join(DATA_DIR, '*.json')):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            all_words.extend(data)
    # アルファベット順にソート
    return sorted(all_words, key=lambda x: x['word'].lower())

def build():
    words = load_data()
    
    # Jinja2の設定
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    
    # --- 1. 個別単語ページの生成 ---
    word_template = env.get_template('word.html') # 個別ページ用テンプレート(後で作成)
    search_index = []
    
    for word_data in words:
        word_str = word_data['word']
        
        # HTML生成
        html_content = word_template.render(word=word_data)
        output_path = os.path.join(DOCS_DIR, 'words', f"{word_str}.html")
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
        # 検索用軽量インデックス用データ抽出（単語と最初の意味だけ）
        primary_meaning = word_data['meanings'][0]['translation'] if word_data.get('meanings') else ""
        search_index.append({
            "w": word_str,
            "m": primary_meaning,
            "u": f"words/{word_str}.html"
        })

    # --- 2. 検索用軽量JSONの書き出し ---
    with open(os.path.join(DOCS_DIR, 'api', 'search_index.json'), 'w', encoding='utf-8') as f:
        json.dump(search_index, f, ensure_ascii=False, separators=(',', ':'))

    # --- 3. 単語帳(Book)ごとの処理 ---
    # books["LEAP"] = [word_data1, word_data2, ...]
    books = defaultdict(list)
    for word_data in words:
        if 'mappings' in word_data:
            for mapping in word_data['mappings']:
                books[mapping['book']].append(word_data)

    book_list_template = env.get_template('book_list.html')
    
    for book_name, book_words in books.items():
        # HTML一覧ページの生成
        html_content = book_list_template.render(book_name=book_name, words=book_words)
        with open(os.path.join(DOCS_DIR, 'books', f"{book_name}.html"), 'w', encoding='utf-8') as f:
            f.write(html_content)
            
        # 演習用の軽量JSON（単語帳ごと）の書き出し
        with open(os.path.join(DOCS_DIR, 'api', 'books', f"{book_name}.json"), 'w', encoding='utf-8') as f:
            json.dump(book_words, f, ensure_ascii=False, separators=(',', ':'))

    # --- 4. トップページ (index.html) の生成 ---
    index_template = env.get_template('index.html')
    # トップページには単語帳のリストと総単語数を渡す
    html_content = index_template.render(book_names=list(books.keys()), total_words=len(words))
    with open(os.path.join(DOCS_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html_content)

    # --- 5. 演習トップページ (exercise.html) の生成 ---
    exercise_template = env.get_template('exercise.html')
    html_content = exercise_template.render(book_names=list(books.keys()))
    with open(os.path.join(DOCS_DIR, 'exercise.html'), 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"Build complete! Total words: {len(words)}")

if __name__ == "__main__":
    build()
