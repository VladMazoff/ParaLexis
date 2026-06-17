// vocabulary-integration.js - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ

var VocabularyModule = (function() {
  var instance = null;
  
  function createInstance() {
    console.log('Creating Vocabulary instance...');
    var core = new VocabularyCore();
    var ui = VocabularyUI.init(core); // ← ИЗМЕНЕНО: не new VocabularyUI()
    
    // Внедряем стили
    setTimeout(function() {
      ui.injectStyles && ui.injectStyles();
    }, 100);
    
    return { core: core, ui: ui };
  }
  
  return {
    getInstance: function() {
      if (!instance) {
        instance = createInstance();
      }
      return instance;
    },
    
    init: function() {
      try {
        var instance = this.getInstance();
        // UI уже инициализирован в createInstance()
        console.log('✅ Vocabulary UI initialized with all features');
        return this;
      } catch (error) {
        console.error('❌ Vocabulary init error:', error);
        return null;
      }
    },
    
    // === БАЗОВЫЕ МЕТОДЫ ===
    addWord: function(word, translation) {
      var instance = this.getInstance();
      return instance.ui.addWord(word, translation, { showAnimation: true });
    },
    
    removeWord: function(word) {
      var instance = this.getInstance();
      return instance.core.remove(word);
    },
    
    clearAll: function() {
      var instance = this.getInstance();
      return instance.core.clearAll();
    },
    
    // === МЕТОДЫ ПЕРЕВОДА ===
    translateWord: function(word) {
      var instance = this.getInstance();
      return instance.ui.translateWord ? 
             instance.ui.translateWord(word) : 
             instance.ui.fetchAndShowTranslation(word);
    },
    
    setTranslation: function(word, translation) {
      var instance = this.getInstance();
      return instance.core.setTranslation(word, translation);
    },
    
    getTranslation: function(word) {
      var instance = this.getInstance();
      return instance.core.getTranslation(word);
    },
    
    // === UI МЕТОДЫ ===
    showDictionary: function() {
      var instance = this.getInstance();
      instance.ui.showModal && instance.ui.showModal();
      return true;
    },
    
    hideTranslationCloud: function() {
      var instance = this.getInstance();
      if (instance.ui.hideTranslationCloud) {
        instance.ui.hideTranslationCloud();
      }
      return false;
    },
    
    getAllWordsAsArray: function() {
      try {
        var instance = this.getInstance();
        return instance.core.allWordsArray;
      } catch (error) {
        console.error('Vocabulary getAllWordsAsArray error:', error);
        return [];
      }
    },
    
    getAllWords: function(withTranslationsOnly) {
      try {
        var instance = this.getInstance();
        
        if (withTranslationsOnly === true) {
          return instance.core.wordsWithTranslations;
        } else if (withTranslationsOnly === false) {
          return instance.core.wordsWithoutTranslations;
        } else {
          return instance.core.allWords;
        }
      } catch (error) {
        console.error('Vocabulary getAllWords error:', error);
        return [];
      }
    },
    
    // === УТИЛИТЫ ===
    getStats: function() {
      var instance = this.getInstance();
      return {
        totalWords: instance.core.count,
        wordsWithTranslation: instance.core.wordsWithTranslations.length,
        wordsWithoutTranslation: instance.core.wordsWithoutTranslations.length,
        isOnline: navigator.onLine !== false
      };
    },
    
    // === НОВЫЕ МЕТОДЫ ===
    toggleHoverTranslations: function(enable) {
      var instance = this.getInstance();
      if (enable !== undefined) {
        localStorage.setItem('vocabShowOnHover', enable);
      }
      
      if (instance.ui.initHoverTranslations) {
        instance.ui.initHoverTranslations();
      }
    }
  };
})();

// Автоматическая инициализация
if (typeof window !== 'undefined') {
  window.VocabularyModule = VocabularyModule;
  
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      VocabularyModule.init();
    }, 1000);
  });
}