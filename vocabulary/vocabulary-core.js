// vocabulary-core.js
function VocabularyCore(storageKey) {
  this.storageKey = storageKey || 'karaokeVocabulary';
  this.words = []; // Массив объектов: [{word: "hello", translation: "привет"}, ...]
  this.events = {}; // Система событий
  
  this.load();
}

// Простая система событий
VocabularyCore.prototype.addEventListener = function(event, callback) {
  if (!this.events[event]) this.events[event] = [];
  this.events[event].push(callback);
};

VocabularyCore.prototype.removeEventListener = function(event, callback) {
  if (!this.events[event]) return;
  var index = this.events[event].indexOf(callback);
  if (index > -1) this.events[event].splice(index, 1);
};

VocabularyCore.prototype.dispatchEvent = function(eventName, detail) {
  if (!this.events[eventName]) return;
  var event = { type: eventName, detail: detail || {} };
  for (var i = 0; i < this.events[eventName].length; i++) {
    this.events[eventName][i](event);
  }
};

VocabularyCore.prototype.load = function() {
  try {
    var saved = localStorage.getItem(this.storageKey);
    if (saved) {
      var data = JSON.parse(saved);
      
      // Миграция: если старый формат (массив строк), конвертируем в новый
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
        this.words = data.map(function(word) {
          return { word: word, translation: null };
        });
        console.log('Vocabulary: Migrated ' + this.words.length + ' words to new format');
        this.save(); // Сохраняем в новом формате
      } else if (data.words && Array.isArray(data.words)) {
        this.words = data.words;
      } else {
        this.words = [];
      }
      
      console.log('Vocabulary loaded: ' + this.words.length + ' words');
    }
  } catch (e) {
    console.warn('Vocabulary: Failed to load', e);
    this.words = [];
  }
};

VocabularyCore.prototype.save = function() {
  try {
    localStorage.setItem(this.storageKey, JSON.stringify({
      words: this.words
    }));
  } catch (e) {
    console.warn('Vocabulary: Failed to save', e);
  }
};

VocabularyCore.prototype.normalizeWord = function(word) {
  return word.trim().toLowerCase();
};

// Найти индекс слова в массиве
VocabularyCore.prototype._findWordIndex = function(cleanWord) {
  for (var i = 0; i < this.words.length; i++) {
    if (this.words[i].word === cleanWord) {
      return i;
    }
  }
  return -1;
};

VocabularyCore.prototype.add = function(word, translation) {
  var cleanWord = this.normalizeWord(word);
  if (!cleanWord) return false;
  
  var translationValue = translation || null;
  
  // Удаляем если уже есть (чтобы переместить в начало)
  var existingIndex = this._findWordIndex(cleanWord);
  if (existingIndex !== -1) {
    // Сохраняем существующий перевод, если не указан новый
    if (translationValue === null && this.words[existingIndex].translation) {
      translationValue = this.words[existingIndex].translation;
    }
    this.words.splice(existingIndex, 1);
  }
  
  // Добавляем в начало (последние первыми)
  this.words.unshift({
    word: cleanWord,
    translation: translationValue
  });
  
  // Ограничиваем размер (опционально)
  if (this.words.length > 1000) {
    this.words = this.words.slice(0, 1000);
  }
  
  this.save();
  this.dispatchEvent('vocabulary:changed', { 
    action: 'add', 
    word: cleanWord,
    translation: translationValue,
    count: this.words.length
  });
  return true;
};

VocabularyCore.prototype._removeInternal = function(cleanWord) {
  var index = this._findWordIndex(cleanWord);
  
  if (index !== -1) {
    this.words.splice(index, 1);
    return true;
  }
  return false;
};

VocabularyCore.prototype.remove = function(word) {
  var cleanWord = this.normalizeWord(word);
  var wasRemoved = this._removeInternal(cleanWord);
  
  if (wasRemoved) {
    this.save();
    this.dispatchEvent('vocabulary:changed', { 
      action: 'remove', 
      word: cleanWord,
      count: this.words.length
    });
  }
  return wasRemoved;
};

VocabularyCore.prototype.clearAll = function() {
  var count = this.words.length;
  this.words = [];
  
  this.save();
  this.dispatchEvent('vocabulary:changed', { 
    action: 'clear',
    count: 0,
    clearedCount: count
  });
  return count;
};

// Установить или обновить перевод
VocabularyCore.prototype.setTranslation = function(word, translation) {
  var cleanWord = this.normalizeWord(word);
  
  // ПРОСТАЯ ОЧИСТКА ПЕРЕВОДА ОТ КАВЫЧЕК И ДЕФИСОВ
  var cleanTranslation = translation ? 
    translation.replace(/^["'`\-\s]+|["'`\-\s]+$/g, '').trim() : 
    null;
  
  var index = this._findWordIndex(cleanWord);
  
  if (index === -1) {
    // Слова нет - добавляем с переводом
    return this.add(word, cleanTranslation);
  }
  
  var oldTranslation = this.words[index].translation;
  this.words[index].translation = cleanTranslation;
  
  this.save();
  this.dispatchEvent('vocabulary:translation:changed', {
    action: cleanTranslation ? 'set' : 'remove',
    word: cleanWord,
    translation: cleanTranslation,
    oldTranslation: oldTranslation
  });
  
  return true;
};

// Получить перевод слова
VocabularyCore.prototype.getTranslation = function(word) {
  var cleanWord = this.normalizeWord(word);
  var index = this._findWordIndex(cleanWord);
  
  return index !== -1 ? this.words[index].translation : null;
};

// Удалить перевод (оставить слово)
VocabularyCore.prototype.removeTranslation = function(word) {
  return this.setTranslation(word, null);
};

VocabularyCore.prototype.search = function(query) {
  var q = this.normalizeWord(query);
  if (!q) return this.words.slice(); // Копия массива
  
  var results = [];
  for (var i = 0; i < this.words.length; i++) {
    if (this.words[i].word.indexOf(q) !== -1) {
      results.push(this.words[i]);
    }
  }
  return results;
};

VocabularyCore.prototype.getSorted = function(order) {
  var wordsCopy = this.words.slice();
  
  if (order === 'alphabet') {
    return wordsCopy.sort(function(a, b) {
      return a.word.localeCompare ? a.word.localeCompare(b.word) : 
        (a.word === b.word ? 0 : (a.word < b.word ? -1 : 1));
    });
  }
  
  // 'date' - возвращаем как есть (последние уже первые)
  return wordsCopy;
};

VocabularyCore.prototype.export = function(format) {
  var wordsArray = this.words.map(function(item) {
    return item.word + (item.translation ? ' ; ' + item.translation : '');
  });
  
  switch(format) {
    case 'comma':
      return wordsArray.join('\n');
    case 'newline':
      return wordsArray.join('\n');
    case 'json':
      return JSON.stringify(this.words, null, 2);
    case 'words-only':
      // Только слова (для обратной совместимости)
      return this.words.map(function(item) { return item.word; }).join(', ');
    default:
      return wordsArray.join(', ');
  }
};

// Геттеры
Object.defineProperty(VocabularyCore.prototype, 'count', {
  get: function() {
    return this.words.length;
  }
});

// Все слова как массив объектов
Object.defineProperty(VocabularyCore.prototype, 'allWords', {
  get: function() {
    return this.words.slice();
  }
});

// Все слова как массив строк (для обратной совместимости)
Object.defineProperty(VocabularyCore.prototype, 'allWordsArray', {
  get: function() {
    return this.words.map(function(item) {
      return item.word;
    });
  }
});

// Слова без переводов
Object.defineProperty(VocabularyCore.prototype, 'wordsWithoutTranslations', {
  get: function() {
    return this.words.filter(function(item) {
      return !item.translation;
    }).map(function(item) {
      return item.word;
    });
  }
});

// Слова с переводами
Object.defineProperty(VocabularyCore.prototype, 'wordsWithTranslations', {
  get: function() {
    return this.words.filter(function(item) {
      return item.translation;
    });
  }
});

// Экспорт
if (typeof window !== 'undefined') {
  window.VocabularyCore = VocabularyCore;
}