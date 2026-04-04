'use client';

import { useState, useRef } from 'react';
import * as PDFJS from 'pdfjs-dist';

PDFJS.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface FileProgress {
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    error?: string;
}

export default function Home() {
    const [csvData, setCsvData] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [fileNames, setFileNames] = useState<string[]>([]);
    const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle bulk file upload
    const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = Array.from(e.target.files || []);
        setFiles(uploadedFiles);
        setFileNames(uploadedFiles.map(f => f.name));
        setFileProgress(uploadedFiles.map(f => ({ name: f.name, status: 'pending' })));
    };

    // Convert PDF to CSV
    const convertPDFtoCSV = async (file: File): Promise<string> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise;
            let csvOutput = '';

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Group text items by y-coordinate into rows
                const Y_TOLERANCE = 3;
                const rowMap = new Map<number, { x: number; str: string }[]>();

                for (const item of textContent.items as any[]) {
                    if (!item.str.trim()) continue;
                    const x: number = item.transform[4];
                    const y: number = item.transform[5];

                    let rowKey: number | undefined;
                    for (const key of rowMap.keys()) {
                        if (Math.abs(key - y) <= Y_TOLERANCE) {
                            rowKey = key;
                            break;
                        }
                    }

                    if (rowKey === undefined) {
                        rowMap.set(y, [{ x, str: item.str }]);
                    } else {
                        rowMap.get(rowKey)!.push({ x, str: item.str });
                    }
                }

                // Sort rows top-to-bottom (PDF y-axis is bottom-up, so descending)
                const sortedRows = Array.from(rowMap.entries())
                    .sort((a, b) => b[0] - a[0]);

                for (const [, items] of sortedRows) {
                    items.sort((a, b) => a.x - b.x);
                    csvOutput += items.map(i => i.str).join(';') + '\n';
                }
            }

            return csvOutput;
        } catch (error) {
            throw new Error(`Failed to process ${file.name}: ${error}`);
        }
    };

    // Convert all files
    const handleConvertAll = async () => {
        if (files.length === 0) {
            alert('Please select PDF files first');
            return;
        }

        setIsProcessing(true);
        let combinedCSV = '';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Update progress
            setFileProgress(prev =>
                prev.map((p, idx) =>
                    idx === i ? { ...p, status: 'processing' } : p
                )
            );

            try {
                const csv = await convertPDFtoCSV(file);
                combinedCSV += `\n--- ${file.name} ---\n${csv}`;

                // Mark as completed
                setFileProgress(prev =>
                    prev.map((p, idx) =>
                        idx === i ? { ...p, status: 'completed' } : p
                    )
                );
            } catch (error) {
                setFileProgress(prev =>
                    prev.map((p, idx) =>
                        idx === i ? { ...p, status: 'error', error: String(error) } : p
                    )
                );
            }
        }

        setCsvData(combinedCSV);
        setIsProcessing(false);
    };

    // Editable textarea handler
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCsvData(e.target.value);
    };

    // Replace All function
    const handleReplaceAll = () => {
        if (!findText) {
            alert('Please enter text to find');
            return;
        }
        try {
            const regex = new RegExp(findText, 'g');
            const matches = csvData.match(regex);
            const count = matches ? matches.length : 0;
            const updated = csvData.replace(regex, replaceText);
            setCsvData(updated);
            alert(`Replaced ${count} occurrences`);
        } catch (error) {
            alert('Invalid regex pattern');
        }
    };

    // Find All function
    const handleFindAll = () => {
        if (!findText) {
            alert('Please enter text to find');
            return;
        }
        try {
            const regex = new RegExp(findText, 'g');
            const matches = csvData.match(regex);
            const count = matches ? matches.length : 0;
            alert(`Found ${count} occurrences`);
        } catch (error) {
            alert('Invalid regex pattern');
        }
    };

    // Remove duplicates
    const handleRemoveDuplicates = () => {
        const lines = csvData.split('\n');
        const unique = [...new Set(lines)];
        const removed = lines.length - unique.length;
        setCsvData(unique.join('\n'));
        alert(`Removed ${removed} duplicate lines`);
    };

    // Clear all
    const handleClear = () => {
        if (confirm('Clear all data? This cannot be undone.')) {
            setCsvData('');
            setFiles([]);
            setFileNames([]);
            setFileProgress([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Download CSV
    const handleDownload = () => {
        if (!csvData) {
            alert('No data to download');
            return;
        }

        const element = document.createElement('a');
        const file = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        element.href = URL.createObjectURL(file);
        element.download = `converted-${new Date().getTime()}.csv`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    // Copy to clipboard
    const handleCopyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(csvData);
            alert('Copied to clipboard!');
        } catch (error) {
            alert('Failed to copy to clipboard');
        }
    };

    const lineCount = csvData.split('\n').filter(l => l.trim()).length;
    const charCount = csvData.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-800 via-teal-700 to-teal-900 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-2">
                        PDF to CSV
                    </h1>
                    <p className="text-teal-200 text-lg">
                        Convert PDFs to CSV with bulk upload and editing
                    </p>
                </div>

                {/* Main Controls */}
                <div className="bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 mb-6 border border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <button className="relative group">
                            <label
                                htmlFor="bulkUpload"
                                className="block w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded cursor-pointer transition-colors"
                            >
                                📁 Choose Files
                            </label>
                            <input
                                ref={fileInputRef}
                                id="bulkUpload"
                                type="file"
                                multiple
                                accept=".pdf"
                                onChange={handleBulkUpload}
                                className="hidden"
                            />
                        </button>

                        <button
                            onClick={handleConvertAll}
                            disabled={files.length === 0 || isProcessing}
                            className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded transition-colors"
                        >
                            {isProcessing ? '⏳ Converting...' : '⚙️ Convert All'}
                        </button>

                        <button
                            onClick={handleDownload}
                            disabled={!csvData}
                            className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded transition-colors"
                        >
                            💾 Save CSV
                        </button>

                        <button
                            onClick={handleClear}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded transition-colors"
                        >
                            🗑️ Clear All
                        </button>
                    </div>

                    {/* File list with progress */}
                    {fileNames.length > 0 && (
                        <div className="p-4 bg-gray-700 rounded border border-gray-600">
                            <p className="text-sm font-semibold text-teal-300 mb-3">
                                📋 Selected Files ({fileNames.length}):
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {fileProgress.map((progress, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between text-sm p-2 bg-gray-800 rounded"
                                    >
                                        <span className="text-gray-300">{progress.name}</span>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${progress.status === 'completed' ? 'bg-green-600 text-green-100' :
                                                progress.status === 'processing' ? 'bg-blue-600 text-blue-100' :
                                                    progress.status === 'error' ? 'bg-red-600 text-red-100' :
                                                        'bg-gray-600 text-gray-200'
                                            }`}>
                                            {progress.status === 'completed' && '✓ Done'}
                                            {progress.status === 'processing' && '⏳ Processing'}
                                            {progress.status === 'error' && '✗ Error'}
                                            {progress.status === 'pending' && '⏳ Pending'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Text Editing Tools */}
                {csvData && (
                    <div className="bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 mb-6 border border-gray-700">
                        <h2 className="text-2xl font-bold text-white mb-4">✏️ Edit Tools</h2>

                        {/* Find & Replace */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-teal-300 mb-2">
                                    Find
                                </label>
                                <input
                                    type="text"
                                    value={findText}
                                    onChange={(e) => setFindText(e.target.value)}
                                    placeholder="Text to find..."
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:border-teal-500"
                                    onKeyPress={(e) => e.key === 'Enter' && handleFindAll()}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-teal-300 mb-2">
                                    Replace With
                                </label>
                                <input
                                    type="text"
                                    value={replaceText}
                                    onChange={(e) => setReplaceText(e.target.value)}
                                    placeholder="Replacement text..."
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:border-teal-500"
                                    onKeyPress={(e) => e.key === 'Enter' && handleReplaceAll()}
                                />
                            </div>
                            <div className="flex gap-2 items-end">
                                <button
                                    onClick={handleFindAll}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                                >
                                    🔍 Find
                                </button>
                                <button
                                    onClick={handleReplaceAll}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded transition-colors"
                                >
                                    🔄 Replace
                                </button>
                            </div>
                        </div>

                        {/* Text Utilities */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <button
                                onClick={handleRemoveDuplicates}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded text-sm transition-colors"
                            >
                                🔗 Duplicates
                            </button>
                            <button
                                onClick={() => setCsvData(csvData.toUpperCase())}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors"
                            >
                                ABC UPPER
                            </button>
                            <button
                                onClick={() => setCsvData(csvData.toLowerCase())}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors"
                            >
                                abc lower
                            </button>
                            <button
                                onClick={() => setCsvData(csvData.trim())}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors"
                            >
                                ✂️ Trim
                            </button>
                            <button
                                onClick={handleCopyToClipboard}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded text-sm transition-colors"
                            >
                                📋 Copy
                            </button>
                        </div>
                    </div>
                )}

                {/* Editable CSV Textarea */}
                <div className="bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
                    <label className="block text-lg font-bold text-white mb-3">
                        📝 Raw CSV (Editable)
                    </label>
                    <textarea
                        value={csvData}
                        onChange={handleTextChange}
                        className="w-full h-96 p-4 bg-gray-900 border-2 border-gray-700 rounded font-mono text-sm text-gray-100 resize-none focus:outline-none focus:border-teal-500 transition-colors"
                        placeholder="Converted CSV will appear here... You can edit directly!"
                    />
                    <div className="flex justify-between items-center mt-3 text-sm text-gray-400">
                        <p>Lines: {lineCount} | Characters: {charCount}</p>
                        <p className="text-xs">Press Ctrl+A to select all</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-teal-300 mt-8 py-4 border-t border-gray-700">
                    <p className="text-sm">
                        🚀 Built with Next.js, React & Docker | Deployed on Hostinger
                    </p>
                </div>
            </div>
        </div>
    );
}