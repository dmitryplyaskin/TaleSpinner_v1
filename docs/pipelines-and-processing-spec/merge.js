const fs = require('fs');
const path = require('path');

// Настройки
const outputFileName = 'full-docs.txt';
const dirPath = __dirname; // Текущая папка

function mergeDocs() {
  try {
    // 1. Читаем список файлов в папке
    const files = fs.readdirSync(dirPath);

    // 2. Фильтруем: оставляем только те, что начинаются с цифры и заканчиваются на .md
    const targetFiles = files
      .filter(file => /^\d/.test(file) && file.endsWith('.md'))
      .sort(); // Сортируем (10, 20, 30...)

    console.log(`Найдено файлов: ${targetFiles.length}`);
    console.log(targetFiles.join('\n'));

    let fullText = '';

    // 3. Проходим по файлам и склеиваем
    targetFiles.forEach(file => {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
      
      // Добавляем разделитель и название файла для удобства (можно убрать)
      fullText += `\n\n========================================\n`;
      fullText += `FILE: ${file}\n`;
      fullText += `========================================\n\n`;
      
      fullText += content;
    });

    // 4. Записываем результат
    fs.writeFileSync(path.join(dirPath, outputFileName), fullText);
    console.log(`\nГотово! Результат сохранен в: ${outputFileName}`);

  } catch (err) {
    console.error('Произошла ошибка:', err);
  }
}

mergeDocs();