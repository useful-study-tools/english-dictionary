document.addEventListener('DOMContentLoaded', () => {
    // --- UI要素 ---
    const setupScreen = document.getElementById('setup-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const resultScreen = document.getElementById('result-screen');
    
    const startBtn = document.getElementById('start-btn');
    const nextBtn = document.getElementById('next-btn');
    const retryBtn = document.getElementById('retry-btn');
    
    const bookSelect = document.getElementById('book-select');
    const rangeRadios = document.getElementsByName('range-type');
    const rangeIdContainer = document.getElementById('range-id-container');
    const rangeChapterContainer = document.getElementById('range-chapter-container');
    const chapterCheckboxes = document.getElementById('chapter-checkboxes');
    
    const questionTypeSelect = document.getElementById('question-type');
    const questionCountSelect = document.getElementById('question-count');
    
    const progressText = document.getElementById('progress-text');
    const quizModeText = document.getElementById('quiz-mode-text');
    const quizDynamicContainer = document.getElementById('quiz-dynamic-container');
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackText = document.getElementById('feedback-text');
    
    // --- 状態管理 ---
    let currentWordsData = [];
    let quizWords = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let isAnswered = false;
    let currentMode = '';

    // --- ユーティリティ ---
    const shuffleArray = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    // IDパース処理 (例: "345" -> 345.000, "345-2" -> 345.002)
    // 飛び番号や枝番号の大小関係を正しく比較するための変換
    const parseWordId = (idStr) => {
        if (!idStr) return 0;
        const str = String(idStr).trim();
        const parts = str.split('-');
        let num = parseFloat(parts[0]) || 0;
        if (parts.length > 1) {
            num += (parseFloat(parts[1]) || 0) / 1000;
        }
        return num;
    };

    // --- 設定画面のイベント ---

    // 範囲選択のトグル
    Array.from(rangeRadios).forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'id') {
                rangeIdContainer.classList.remove('hidden');
                rangeChapterContainer.classList.add('hidden');
            } else {
                rangeIdContainer.classList.add('hidden');
                rangeChapterContainer.classList.remove('hidden');
            }
        });
    });

    // 単語帳変更時にデータを取得し、チャプターリストを更新
    const loadBookData = async () => {
        const bookName = bookSelect.value;
        if (!bookName) return;
        
        startBtn.textContent = 'データ読み込み中...';
        startBtn.disabled = true;
        
        try {
            const response = await fetch(`/api/books/${bookName}.json`);
            if (!response.ok) throw new Error('Fetch failed');
            currentWordsData = await response.json();
            
            // チャプター(category)の抽出
            const categories = new Set();
            currentWordsData.forEach(w => {
                const map = w.mappings.find(m => m.book === bookName);
                if (map && map.category) categories.add(map.category);
            });
            
            // チェックボックスの生成
            chapterCheckboxes.innerHTML = '';
            if (categories.size > 0) {
                Array.from(categories).sort().forEach(cat => {
                    const lbl = document.createElement('label');
                    lbl.className = 'flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer';
                    lbl.innerHTML = `<input type="checkbox" value="${cat}" class="chapter-cb form-checkbox text-indigo-600 rounded"> <span class="text-sm text-gray-700">${cat}</span>`;
                    chapterCheckboxes.appendChild(lbl);
                });
            } else {
                chapterCheckboxes.innerHTML = '<div class="p-2 text-sm text-gray-500">チャプター情報がありません</div>';
            }
            
            startBtn.textContent = '演習をスタート';
            startBtn.disabled = false;
        } catch (err) {
            console.error(err);
            startBtn.textContent = 'エラーが発生しました';
        }
    };

    // 初期ロードと変更時のバインド
    if (bookSelect.options.length > 1) {
        bookSelect.selectedIndex = 1; // 最初の有効な選択肢
        loadBookData();
    }
    bookSelect.addEventListener('change', loadBookData);

    // --- クイズ開始処理 ---
    startBtn.addEventListener('click', () => {
        const bookName = bookSelect.value;
        const rangeType = document.querySelector('input[name="range-type"]:checked').value;
        const countLimit = parseInt(questionCountSelect.value, 10);
        currentMode = questionTypeSelect.value;
        
        let filtered = [];

        // フィルタリング
        if (rangeType === 'id') {
            const startVal = document.getElementById('id-start').value;
            const endVal = document.getElementById('id-end').value;
            const startId = startVal ? parseWordId(startVal) : 0;
            const endId = endVal ? parseWordId(endVal) : 999999;
            
            filtered = currentWordsData.filter(w => {
                const map = w.mappings.find(m => m.book === bookName);
                if (!map) return false;
                const wid = parseWordId(map.id);
                return wid >= startId && wid <= endId;
            });
        } else {
            const checkedCbs = Array.from(document.querySelectorAll('.chapter-cb:checked')).map(cb => cb.value);
            if (checkedCbs.length === 0) {
                alert('チャプターを1つ以上選択してください。');
                return;
            }
            filtered = currentWordsData.filter(w => {
                const map = w.mappings.find(m => m.book === bookName);
                if (!map) return false;
                return checkedCbs.includes(map.category);
            });
        }

        if (filtered.length === 0) {
            alert('指定された範囲に単語が見つかりませんでした。条件を変更してください。');
            return;
        }

        // シャッフル＆カット
        quizWords = shuffleArray(filtered).slice(0, countLimit);
        currentQuestionIndex = 0;
        score = 0;
        
        // ヘッダーのモード名設定
        const modeLabel = questionTypeSelect.options[questionTypeSelect.selectedIndex].text;
        quizModeText.textContent = modeLabel;

        setupScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        renderQuestion();
    });

    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < quizWords.length) {
            renderQuestion();
        } else {
            showResult();
        }
    });

    retryBtn.addEventListener('click', () => {
        resultScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
    });

    // --- クイズ描画 (ルーティング) ---
    const renderQuestion = () => {
        isAnswered = false;
        feedbackArea.classList.add('hidden');
        quizDynamicContainer.innerHTML = '';
        progressText.textContent = `Question ${currentQuestionIndex + 1} / ${quizWords.length}`;
        
        const wordData = quizWords[currentQuestionIndex];
        const primaryMeaning = wordData.meanings[0].translation;

        if (currentMode === 'flash-en-ja') {
            renderFlashcard(wordData.word, primaryMeaning, wordData.pronunciation?.us);
        } else if (currentMode === 'flash-ja-en') {
            renderFlashcard(primaryMeaning, wordData.word, null);
        } else if (currentMode === 'choice-en-ja') {
            renderChoice(wordData, 'en', 'ja', wordData.word, primaryMeaning);
        } else if (currentMode === 'choice-ja-en') {
            renderChoice(wordData, 'ja', 'en', primaryMeaning, wordData.word);
        } else if (currentMode === 'fill-blank') {
            renderFillBlank(wordData);
        }
    };

    // --- 1. 暗記カードUI ---
    const renderFlashcard = (frontText, backText, subText) => {
        const card = document.createElement('div');
        card.className = 'text-center';
        
        let html = `
            <div class="mb-10 min-h-[120px] flex flex-col justify-center">
                <h2 class="text-4xl md:text-5xl font-extrabold text-gray-900 mb-2">${frontText}</h2>
                ${subText ? `<p class="text-gray-500 font-mono text-sm">${subText}</p>` : ''}
            </div>
            <button id="flip-btn" class="w-full md:w-1/2 mx-auto bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 px-6 rounded-lg border-2 border-gray-300 transition-colors">
                答えを見る
            </button>
            <div id="back-area" class="hidden mt-8 opacity-0 transition-opacity duration-300">
                <div class="text-3xl font-bold text-indigo-600 mb-8">${backText}</div>
                <div class="grid grid-cols-2 gap-4">
                    <button class="ans-btn bg-white border-2 border-rose-400 text-rose-600 font-bold py-3 rounded-lg hover:bg-rose-50" data-correct="false">❌ 知らなかった</button>
                    <button class="ans-btn bg-white border-2 border-emerald-400 text-emerald-600 font-bold py-3 rounded-lg hover:bg-emerald-50" data-correct="true">⭕️ 知っていた</button>
                </div>
            </div>
        `;
        card.innerHTML = html;
        quizDynamicContainer.appendChild(card);

        document.getElementById('flip-btn').addEventListener('click', (e) => {
            e.target.classList.add('hidden');
            const backArea = document.getElementById('back-area');
            backArea.classList.remove('hidden');
            setTimeout(() => backArea.classList.remove('opacity-0'), 10);
        });

        card.querySelectorAll('.ans-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (isAnswered) return;
                isAnswered = true;
                const isCorrect = e.target.dataset.correct === 'true';
                if (isCorrect) score++;
                handleFeedback(isCorrect, isCorrect ? "Great!" : "Next time!");
            });
        });
    };

    // --- 2. 4択問題UI ---
    const renderChoice = (targetWord, qLang, aLang, questionText, correctText) => {
        const container = document.createElement('div');
        
        let subText = (qLang === 'en' && targetWord.pronunciation?.us) ? targetWord.pronunciation.us : '';
        
        let html = `
            <div class="text-center mb-10 min-h-[100px] flex flex-col justify-center">
                <h2 class="text-4xl font-extrabold text-gray-900 mb-2">${questionText}</h2>
                ${subText ? `<p class="text-gray-500 font-mono text-sm">${subText}</p>` : ''}
            </div>
            <div id="choices-area" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
        `;
        container.innerHTML = html;
        quizDynamicContainer.appendChild(container);

        // ダミー選択肢の生成
        const wrongWords = shuffleArray(currentWordsData.filter(w => w.word !== targetWord.word)).slice(0, 3);
        const wrongTexts = wrongWords.map(w => aLang === 'en' ? w.word : w.meanings[0].translation);
        const choices = shuffleArray([correctText, ...wrongTexts]);

        const choicesArea = document.getElementById('choices-area');
        choices.forEach(choiceText => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn w-full bg-white border-2 border-gray-200 text-gray-800 font-bold py-4 px-6 rounded-lg text-left hover:border-indigo-400 hover:bg-indigo-50 transition-all';
            btn.textContent = choiceText;
            
            btn.addEventListener('click', () => {
                if (isAnswered) return;
                isAnswered = true;
                const isCorrect = (choiceText === correctText);
                if (isCorrect) score++;
                
                // 色の変更
                document.querySelectorAll('.choice-btn').forEach(b => {
                    b.disabled = true;
                    b.classList.remove('hover:border-indigo-400', 'hover:bg-indigo-50');
                    if (b.textContent === correctText) {
                        b.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
                    } else if (b === btn && !isCorrect) {
                        b.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-700');
                    } else {
                        b.classList.add('opacity-50');
                    }
                });
                handleFeedback(isCorrect, isCorrect ? "⭕️ 正解！" : `❌ 不正解... (正解: ${correctText})`);
            });
            choicesArea.appendChild(btn);
        });
    };

    // --- 3. 例文穴埋めUI ---
    const renderFillBlank = (targetWord) => {
        const container = document.createElement('div');
        
        // 例文を一つ探す
        let exampleEn = "";
        let exampleJa = "";
        for (let m of targetWord.meanings) {
            if (m.examples && m.examples.length > 0) {
                exampleEn = m.examples[0].en;
                exampleJa = m.examples[0].ja;
                break;
            }
        }

        let questionHTML = "";
        if (exampleEn) {
            // 単語部分をアンダーバーに置換（大文字小文字無視で簡易置換）
            const regex = new RegExp(targetWord.word, 'ig');
            const blankedEn = exampleEn.replace(regex, `<span class="inline-block border-b-2 border-gray-400 w-24 mx-1"></span>`);
            questionHTML = `
                <div class="text-xl md:text-2xl font-medium text-gray-800 leading-relaxed mb-3">${blankedEn}</div>
                <div class="text-sm text-gray-500 mb-2">${exampleJa}</div>
            `;
        } else {
            // 例文がない場合のフォールバック
            questionHTML = `
                <div class="text-xl md:text-2xl font-medium text-gray-800 mb-3">意味: ${targetWord.meanings[0].translation}</div>
                <div class="text-sm text-rose-500 mb-2">※この単語には例文データがありません</div>
            `;
        }

        container.innerHTML = `
            <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8 text-center">
                ${questionHTML}
            </div>
            <div class="max-w-xs mx-auto text-center">
                <input type="text" id="spell-input" placeholder="スペルを入力..." class="w-full text-center text-2xl font-bold bg-white border-2 border-gray-300 py-3 px-4 rounded-lg focus:outline-none focus:border-indigo-500 mb-4" autocomplete="off" spellcheck="false">
                <button id="submit-spell-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">回答する</button>
            </div>
        `;
        quizDynamicContainer.appendChild(container);

        const input = document.getElementById('spell-input');
        const submitBtn = document.getElementById('submit-spell-btn');

        input.focus();

        const checkAnswer = () => {
            if (isAnswered) return;
            const userAns = input.value.trim().toLowerCase();
            const correctAns = targetWord.word.toLowerCase();
            
            if (!userAns) return; // 空打ち無視
            isAnswered = true;
            input.disabled = true;
            submitBtn.disabled = true;

            const isCorrect = (userAns === correctAns);
            if (isCorrect) {
                score++;
                input.classList.add('border-emerald-500', 'text-emerald-600', 'bg-emerald-50');
            } else {
                input.classList.add('border-rose-500', 'text-rose-600', 'bg-rose-50');
            }

            handleFeedback(isCorrect, isCorrect ? "⭕️ 正解！" : `❌ 不正解... (正解: ${targetWord.word})`);
        };

        submitBtn.addEventListener('click', checkAnswer);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkAnswer();
        });
    };

    // --- フィードバックと結果 ---
    const handleFeedback = (isCorrect, text) => {
        feedbackText.textContent = text;
        feedbackText.className = `text-xl font-bold mb-4 ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`;
        feedbackArea.classList.remove('hidden');
    };

    const showResult = () => {
        quizScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');
        
        scoreText.textContent = `${score} / ${quizWords.length}`;
        const accuracy = score / quizWords.length;
        
        if (accuracy === 1) {
            scoreMessage.textContent = "Perfect!! 完璧です！🎉";
            scoreMessage.className = "text-emerald-600 font-bold mt-2";
        } else if (accuracy >= 0.7) {
            scoreMessage.textContent = "Great job! その調子です👍";
            scoreMessage.className = "text-indigo-600 font-bold mt-2";
        } else {
            scoreMessage.textContent = "Keep trying! 復習しましょう💪";
            scoreMessage.className = "text-rose-600 font-bold mt-2";
        }
    };
});
