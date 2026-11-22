import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const csvFilePath = path.join(process.cwd(), '単語辞書.csv');
const jsFilePath = path.join(process.cwd(), 'src', 'hymmnos_dictionary.js');

export const parseCSV = (csvStr) => {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvStr.length; i++) {
        const char = csvStr[i];
        if (char === '"' && inQuotes && csvStr[i + 1] === '"') {
            currentCell += '"';
            i++;
        } else if (char === '"') {
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
    if (inQuotes) throw new Error('CSV contains an unclosed quoted field');
    // push the last row
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    return rows;
};

export const parseDictionary = (csvData) => {
    const rows = parseCSV(csvData.replace(/^\uFEFF/, ''));
    const dictionary = [];

    // Column order: word, meaning, pronunciation, part of speech, dialect, notes.
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => !cell)) continue;
        if (row.length < 4 || !row[0]) throw new Error(`Invalid dictionary row ${i + 1}`);

        dictionary.push({
            word: row[0],
            meaning: row[1],
            pronunciation: row[2] || "",
            tags: row[3] ? [row[3]] : [],
            dialect: row[4] || ""
        });
    }

    if (!dictionary.length) throw new Error('CSV contains no dictionary entries');
    return dictionary;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const options = process.argv.slice(2);
    if (options.some(option => option !== '--allow-changes')) {
        throw new Error('Unknown option; use --allow-changes to replace or remove existing entries');
    }
    const dictionary = parseDictionary(fs.readFileSync(csvFilePath, 'utf8'));
    if (fs.existsSync(jsFilePath) && !options.includes('--allow-changes')) {
        const currentSource = fs.readFileSync(jsFilePath, 'utf8');
        const match = currentSource.match(/^\s*export\s+const\s+HYMMNOS_DICTIONARY\s*=\s*([\s\S]*?)\s*;?\s*$/);
        if (!match) throw new Error('Cannot read the existing dictionary; no changes were made');
        const current = JSON.parse(match[1]);
        if (!Array.isArray(current)) throw new Error('Existing dictionary must be an array');
        const key = entry => JSON.stringify([entry.word, entry.meaning, entry.pronunciation, entry.tags, entry.dialect]);
        const counts = new Map();
        for (const entry of dictionary) counts.set(key(entry), (counts.get(key(entry)) || 0) + 1);
        for (const entry of current) {
            const remaining = counts.get(key(entry)) || 0;
            if (!remaining) {
                throw new Error(`Import would remove or change ${entry.word}; use --allow-changes only after reviewing the CSV`);
            }
            counts.set(key(entry), remaining - 1);
        }
    }
    const jsContent = 'export const HYMMNOS_DICTIONARY = ' + JSON.stringify(dictionary, null, 2) + ';\n';

    fs.writeFileSync(jsFilePath, jsContent, 'utf8');
    console.log('Dictionary successfully updated with ' + dictionary.length + ' entries.');
}
