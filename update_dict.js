import fs from 'fs';
import path from 'path';

const csvFilePath = path.join(process.cwd(), '単語辞書.csv');
const jsFilePath = path.join(process.cwd(), 'src', 'hymmnos_dictionary.js');

const parseCSV = (csvStr) => {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvStr.length; i++) {
        const char = csvStr[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else if (char !== '\r') {
            currentCell += char;
        }
    }
    // push the last row
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    return rows;
};

// Read the CSV
const csvData = fs.readFileSync(csvFilePath, 'utf8');

// Parse
const rows = parseCSV(csvData);

const dictionary = [];

// Start loop from 1 to skip header
for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4 || !row[0]) continue;
    
    // CSV column mapping:
    //  0: word   1: meaning   2: pronunciation   3: tags(品詞)   4: dialect(流派)   5: notes
    const tags = row[3] ? [row[3]] : [];

    dictionary.push({
        word: row[0],
        meaning: row[1],
        pronunciation: row[2] || "",
        tags: tags,
        dialect: row[4] || ""
    });
}

// Generate the new js file content
const jsContent = 'export const HYMMNOS_DICTIONARY = ' + JSON.stringify(dictionary, null, 2) + ';';

// Write back to hymmnos_dictionary.js
fs.writeFileSync(jsFilePath, jsContent, 'utf8');
console.log('Dictionary successfully updated with ' + dictionary.length + ' entries.');
