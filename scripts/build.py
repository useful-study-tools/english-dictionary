import os
import json
from jinja2 import Environment, FileSystemLoader

# ディレクトリの設定
DATA_DIR = 'data'
TEMPLATE_DIR = 'templates'
OUTPUT_DIR = 'docs'

def main():
    # 1. データの読み込み
    all_words = []
    if not os.path.exists(DATA_DIR):
        print(f"エラー: '{DATA_DIR}' フォルダが見つかりません。")
        return

    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.json'):
            with open(os.path.join(DATA_DIR, filename), 'r', encoding='utf-8') as f:
                data = json.load(f)
                all_words.extend(data)

    # 2. 単語帳(books)ごとにデータを分類 ＆ 検索用インデックスの作成
    books = {}
    search_index = []

    for word in all_words:
        # 検索用インデックス (w: 単語, m: 意味, u: URL)
        meaning = word['meanings'][0]['translation'] if word.get('meanings') else ""
        search_index.append({
            "w": word['word'],
            "m": meaning,
            "u": f"words/{word['word']}.html"
        })

        # 単語帳ごとの分類
        for mapping in word.get('mappings', []):
            book_name = mapping['book']
            if book_name not in books:
                books[book_name] = []
            books[book_name].append(word)

    # 3. Jinja2 (テンプレートエンジン) の準備
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

    # 4. 出力先フォルダの作成
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(f"{OUTPUT_DIR}/words", exist_ok=True)
    os.makedirs(f"{OUTPUT_DIR}/books", exist_ok=True)
    os.makedirs(f"{OUTPUT_DIR}/api/books", exist_ok=True)

    # 5. 各ページの生成 (レンダリング)
    
    # トップページ (index.html)
    index_template = env.get_template('index.html')
    with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(index_template.render(total_words=len(all_words), book_names=list(books.keys())))

    # 演習ページ (exercise.html)
    exercise_template = env.get_template('exercise.html')
    with open(os.path.join(OUTPUT_DIR, 'exercise.html'), 'w', encoding='utf-8') as f:
        f.write(exercise_template.render(book_names=list(books.keys())))

    # 個別単語ページ (words/xxx.html)
    word_template = env.get_template('word.html')
    for word in all_words:
        with open(os.path.join(OUTPUT_DIR, 'words', f"{word['word']}.html"), 'w', encoding='utf-8') as f:
            f.write(word_template.render(word=word))

    # 単語帳一覧ページ (books/xxx.html) & 演習用API JSON (api/books/xxx.json)
    book_list_template = env.get_template('book_list.html')
    for book_name, words in books.items():
        # HTMLの出力
        with open(os.path.join(OUTPUT_DIR, 'books', f"{book_name}.html"), 'w', encoding='utf-8') as f:
            f.write(book_list_template.render(book_name=book_name, words=words))
        
        # 演習でJSが読み込むためのJSON出力
        with open(os.path.join(OUTPUT_DIR, 'api', 'books', f"{book_name}.json"), 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False)

    # 検索用インデックスの出力 (api/search_index.json)
    with open(os.path.join(OUTPUT_DIR, 'api', 'search_index.json'), 'w', encoding='utf-8') as f:
        json.dump(search_index, f, ensure_ascii=False)

    print(f"ビルド完了: {len(all_words)}単語, {len(books)}冊の単語帳を生成しました。")

if __name__ == "__main__":
    main()
