import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, addDoc, onSnapshot, collection, query, deleteDoc, setDoc, getDocs } from 'firebase/firestore';

// DO NOT TOUCH: Global variables provided by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "demo-key",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

const App = () => {
    const [entries, setEntries] = useState([]);
    const [formInput, setFormInput] = useState({});
    const [statusMessage, setStatusMessage] = useState('');
    const [userId, setUserId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [columns, setColumns] = useState([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState(null);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showApiConfig, setShowApiConfig] = useState(false);
    const [apiKeys, setApiKeys] = useState({
        googleSheets: localStorage.getItem('googleSheetsKey') || '',
        airtable: localStorage.getItem('airtableKey') || '',
        notion: localStorage.getItem('notionKey') || '',
    });

    // Effect to handle Firebase authentication and data fetching
    useEffect(() => {
        if (!auth || !db) {
            // Fallback to localStorage if Firebase fails
            console.log('Firebase not available, using localStorage');
            setUserId('local-user');
            const saved = localStorage.getItem('entries');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    setEntries(data);
                    updateColumns(data);
                } catch (error) {
                    console.error('Error loading saved data:', error);
                }
            }
            setIsLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                try {
                    // Listen for real-time data changes
                    const entriesCollection = collection(db, `artifacts/${appId}/users/${user.uid}/entries`);
                    const unsubscribeSnapshot = onSnapshot(entriesCollection, (snapshot) => {
                        const data = [];
                        snapshot.forEach((doc) => {
                            data.push({ id: doc.id, ...doc.data() });
                        });
                        
                        // Update columns based on current data
                        updateColumns(data);
                        setEntries(data);
                        setIsLoading(false);
                    }, (error) => {
                        console.error("Error listening to Firestore changes:", error);
                        // Fallback to localStorage
                        const saved = localStorage.getItem('entries');
                        if (saved) {
                            try {
                                const data = JSON.parse(saved);
                                setEntries(data);
                                updateColumns(data);
                            } catch (error) {
                                console.error('Error loading saved data:', error);
                            }
                        }
                        setIsLoading(false);
                    });

                    return () => unsubscribeSnapshot();
                } catch (error) {
                    console.error('Firestore setup failed:', error);
                    setIsLoading(false);
                }
            } else {
                setUserId(null);
                setIsLoading(false);
            }
        });

        // Sign in with custom token or anonymously
        const handleAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Firebase auth failed:", error);
                // Set local user ID as fallback
                setUserId('local-user');
                const saved = localStorage.getItem('entries');
                if (saved) {
                    try {
                        const data = JSON.parse(saved);
                        setEntries(data);
                        updateColumns(data);
                    } catch (error) {
                        console.error('Error loading saved data:', error);
                    }
                }
                setIsLoading(false);
            }
        };

        handleAuth();

        return () => unsubscribe();
    }, []);

    const updateColumns = (data) => {
        if (data.length === 0) {
            setColumns([]);
            setFormInput({});
            return;
        }

        const allKeys = new Set();
        data.forEach(entry => {
            Object.keys(entry).forEach(key => {
                if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'importedAt') {
                    allKeys.add(key);
                }
            });
        });
        
        const newColumns = Array.from(allKeys).map(key => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
        }));
        
        setColumns(newColumns);
        
        const emptyForm = {};
        newColumns.forEach(col => {
            emptyForm[col.key] = '';
        });
        if (Object.keys(formInput).length === 0) {
            setFormInput(emptyForm);
        }
        
        if (!sortField && newColumns.length > 0) {
            setSortField(newColumns[0].key);
        }
    };

    const saveApiKey = (platform, key) => {
        try {
            localStorage.setItem(`${platform}Key`, key);
            setApiKeys(prev => ({ ...prev, [platform]: key }));
        } catch (error) {
            console.error('Error saving API key:', error);
        }
    };

    const showMessage = (message, duration = 3000) => {
        setStatusMessage(message);
        setTimeout(() => setStatusMessage(''), duration);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormInput(prev => ({ ...prev, [name]: value }));
    };

    const addNewField = () => {
        const fieldName = window.prompt('Enter new field name:');
        if (fieldName && fieldName.trim()) {
            const key = fieldName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            if (key && !columns.find(col => col.key === key)) {
                const newColumns = [...columns, { key, label: fieldName.trim() }];
                setColumns(newColumns);
                setFormInput(prev => ({ ...prev, [key]: '' }));
                showMessage(`✅ Field "${fieldName.trim()}" added!`);
            } else {
                showMessage('❌ Invalid field name or field already exists');
            }
        }
    };

    const saveToStorage = (data) => {
        try {
            localStorage.setItem('entries', JSON.stringify(data));
            updateColumns(data);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const hasData = Object.values(formInput).some(value => value && value.toString().trim());
        if (!hasData) {
            showMessage('❌ Please enter some data');
            return;
        }
        if (!userId) {
            console.error("User ID is not available.");
            return;
        }
        
        try {
            if (userId === 'local-user' || !db) {
                // Use localStorage fallback
                if (editingId) {
                    const newEntries = entries.map(entry => 
                        entry.id === editingId 
                            ? { ...entry, ...formInput, updatedAt: new Date().toISOString() }
                            : entry
                    );
                    setEntries(newEntries);
                    saveToStorage(newEntries);
                    setEditingId(null);
                    showMessage('✅ Entry updated successfully!');
                } else {
                    const newEntry = {
                        id: Date.now() + Math.random(),
                        ...formInput,
                        createdAt: new Date().toISOString()
                    };
                    const newEntries = [...entries, newEntry];
                    setEntries(newEntries);
                    saveToStorage(newEntries);
                    showMessage('✅ Entry added successfully!');
                }
            } else {
                // Use Firebase
                if (editingId) {
                    const entryDocRef = doc(db, `artifacts/${appId}/users/${userId}/entries`, editingId);
                    await setDoc(entryDocRef, { ...formInput, updatedAt: new Date().toISOString() }, { merge: true });
                    setEditingId(null);
                    showMessage('✅ Entry updated successfully!');
                } else {
                    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/entries`), {
                        ...formInput,
                        createdAt: new Date().toISOString(),
                    });
                    showMessage('✅ Entry added successfully!');
                }
            }
        } catch (error) {
            console.error("Error saving document:", error);
            showMessage('❌ Error saving entry!');
        } finally {
            const emptyForm = {};
            columns.forEach(col => { emptyForm[col.key] = ''; });
            setFormInput(emptyForm);
        }
    };

    const handleEdit = (entry) => {
        const editForm = {};
        columns.forEach(col => { editForm[col.key] = entry[col.key] || ''; });
        setFormInput(editForm);
        setEditingId(entry.id);
        showMessage('✏️ Editing mode activated');
    };

    const handleCancelEdit = () => {
        const emptyForm = {};
        columns.forEach(col => { emptyForm[col.key] = ''; });
        setFormInput(emptyForm);
        setEditingId(null);
        showMessage('❌ Edit cancelled');
    };

    const handleDelete = (id) => {
        setEntryToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            if (userId === 'local-user' || !db) {
                // Use localStorage fallback
                const newEntries = entries.filter(entry => entry.id !== entryToDelete);
                setEntries(newEntries);
                saveToStorage(newEntries);
                showMessage('✅ Entry deleted successfully!');
            } else {
                // Use Firebase
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/entries`, entryToDelete));
                showMessage('✅ Entry deleted successfully!');
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            showMessage('❌ Error deleting entry!');
        } finally {
            setShowDeleteModal(false);
            setEntryToDelete(null);
        }
    };

    const handleClearAll = () => {
        setShowDeleteAllModal(true);
    };

    const confirmClearAll = async () => {
        if (!userId) return;
        try {
            if (userId === 'local-user' || !db) {
                // Use localStorage fallback
                setEntries([]);
                setColumns([]);
                setFormInput({});
                localStorage.removeItem('entries');
                showMessage('✅ All entries cleared successfully!');
            } else {
                // Use Firebase
                const q = query(collection(db, `artifacts/${appId}/users/${userId}/entries`));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
                showMessage('✅ All entries cleared successfully!');
            }
        } catch (error) {
            console.error("Error clearing all entries:", error);
            showMessage('❌ Error clearing entries!');
        } finally {
            setShowDeleteAllModal(false);
        }
    };

    const handleSort = (field) => {
        const order = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortOrder(order);
    };

    const filteredAndSortedEntries = entries
        .filter(entry => 
            columns.some(col => 
                (entry[col.key] || '').toString().toLowerCase().includes(searchTerm.toLowerCase())
            )
        )
        .sort((a, b) => {
            if (!sortField) return 0;
            const aVal = (a[sortField] || '').toString();
            const bVal = (b[sortField] || '').toString();
            const comparison = aVal.localeCompare(bVal);
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    const generateCSV = () => {
        try {
            const header = columns.map(col => `"${col.label}"`).join(',');
            const rows = filteredAndSortedEntries.map(item => 
                columns.map(col => {
                    const value = (item[col.key] || '').toString().replace(/"/g, '""');
                    return `"${value}"`;
                }).join(',')
            ).join('\n');
            return header + '\n' + rows;
        } catch (error) {
            console.error('Error generating CSV:', error);
            return '';
        }
    };

    const downloadFile = (content, filename, type) => {
        try {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error('Error downloading file:', error);
            return false;
        }
    };

    const exportToGoogleSheets = () => {
        try {
            const csvData = generateCSV();
            const encodedData = encodeURIComponent(csvData);
            const url = `https://docs.google.com/spreadsheets/create?usp=drive_web&csv=${encodedData}`;
            window.open(url, '_blank');
            showMessage('✅ Google Sheet created! Check your new tab.');
        } catch (error) {
            console.error('Google Sheets export error:', error);
            showMessage('❌ Google Sheets export failed');
        }
    };

    const exportToAirtable = () => {
        try {
            const jsonData = JSON.stringify(filteredAndSortedEntries, null, 2);
            navigator.clipboard.writeText(jsonData).then(() => {
                window.open('https://airtable.com/create/table', '_blank');
                showMessage('✅ Data copied to clipboard! Paste in Airtable.');
            }).catch(() => {
                downloadFile(jsonData, 'airtable-data.json', 'application/json');
                window.open('https://airtable.com/create/table', '_blank');
                showMessage('✅ Data downloaded! Import the JSON file in Airtable.');
            });
        } catch (error) {
            console.error('Airtable export error:', error);
            showMessage('❌ Airtable export failed');
        }
    };

    const exportToNotion = () => {
        try {
            const csvData = generateCSV();
            navigator.clipboard.writeText(csvData).then(() => {
                window.open('https://www.notion.so/import', '_blank');
                showMessage('✅ CSV data copied! Paste in Notion import page.');
            }).catch(() => {
                downloadFile(csvData, 'notion-data.csv', 'text/csv');
                window.open('https://www.notion.so/import', '_blank');
                showMessage('✅ CSV downloaded! Import the file in Notion.');
            });
        } catch (error) {
            console.error('Notion export error:', error);
            showMessage('❌ Notion export failed');
        }
    };

    const exportToWebhook = async () => {
        const webhookUrl = prompt('Enter webhook URL:');
        if (!webhookUrl) return;

        try {
            showMessage('🔗 Sending to webhook...');
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    data: filteredAndSortedEntries,
                    columns: columns,
                    timestamp: new Date().toISOString(),
                    total: filteredAndSortedEntries.length
                })
            });

            if (response.ok) {
                showMessage('✅ Data sent to webhook successfully!');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Webhook export error:', error);
            showMessage('❌ Webhook export failed. Check URL and try again.');
        }
    };

    const handleExport = (format) => {
        if (entries.length === 0) {
            showMessage('❌ No data to export');
            return;
        }
        
        try {
            let content, filename, type;
            
            if (format === 'csv') {
                content = generateCSV();
                filename = `data-export-${new Date().toISOString().split('T')[0]}.csv`;
                type = 'text/csv';
            } else {
                content = JSON.stringify(filteredAndSortedEntries, null, 2);
                filename = `data-export-${new Date().toISOString().split('T')[0]}.json`;
                type = 'application/json';
            }
            
            if (downloadFile(content, filename, type)) {
                showMessage(`✅ ${format.toUpperCase()} file downloaded successfully!`);
            } else {
                showMessage(`❌ Failed to download ${format.toUpperCase()} file`);
            }
        } catch (error) {
            console.error('Export error:', error);
            showMessage(`❌ Export failed`);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data) && userId) {
                    let imported = 0;
                    if (userId === 'local-user' || !db) {
                        // Use localStorage fallback
                        const importedEntries = data.map(item => ({
                            ...item,
                            id: Date.now() + Math.random(),
                            importedAt: new Date().toISOString()
                        }));
                        const newEntries = [...entries, ...importedEntries];
                        setEntries(newEntries);
                        saveToStorage(newEntries);
                        imported = importedEntries.length;
                    } else {
                        // Use Firebase
                        for (const item of data) {
                            const sanitizedItem = Object.fromEntries(
                                Object.entries(item).filter(([key, value]) => 
                                    key !== 'id' && (typeof value === 'string' || typeof value === 'number')
                                )
                            );
                            if (Object.keys(sanitizedItem).length > 0) {
                                await addDoc(collection(db, `artifacts/${appId}/users/${userId}/entries`), {
                                    ...sanitizedItem,
                                    importedAt: new Date().toISOString()
                                });
                                imported++;
                            }
                        }
                    }
                    showMessage(`✅ Successfully imported ${imported} entries!`);
                } else {
                    showMessage('❌ Import failed - invalid file format!');
                }
            } catch (error) {
                console.error("Import failed:", error);
                showMessage('❌ Import failed - invalid JSON format');
            }
        };
        reader.onerror = () => {
            showMessage('❌ Error reading file');
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const exportOptions = [
        { name: 'Google Sheets', icon: '📊', action: exportToGoogleSheets, color: 'bg-green-600' },
        { name: 'Airtable', icon: '🗃️', action: exportToAirtable, color: 'bg-orange-600' },
        { name: 'Notion', icon: '📝', action: exportToNotion, color: 'bg-gray-700' },
        { name: 'Custom Webhook', icon: '🔗', action: exportToWebhook, color: 'bg-purple-600' },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600 text-lg">Loading...</div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-10 w-full max-w-7xl border border-gray-200">
                
                <div className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-2">🚀 Advanced Data Entry Assistant</h1>
                    <p className="text-gray-600 text-sm sm:text-base mb-4">
                        Easily input, manage, and export your data with cloud-based storage.
                    </p>
                    <div className="flex justify-center gap-2 text-sm text-gray-500">
                        <span>📝 {entries.length} entries</span>
                        <span>•</span>
                        <span>📋 {columns.length} fields</span>
                        <span>•</span>
                        <span>🔍 {filteredAndSortedEntries.length} showing</span>
                    </div>
                </div>

                {columns.length > 0 && (
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 p-6 bg-gray-50 rounded-xl">
                        {columns.map(col => (
                            <div key={col.key}>
                                <label htmlFor={col.key} className="block text-sm font-medium text-gray-700 mb-1">
                                    {col.label}
                                </label>
                                <input 
                                    type="text" 
                                    id={col.key} 
                                    name={col.key} 
                                    value={formInput[col.key] || ''} 
                                    onChange={handleChange}
                                    placeholder={`Enter ${col.label.toLowerCase()}`}
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                                />
                            </div>
                        ))}
                        
                        <div className="md:col-span-2 lg:col-span-3 flex gap-2 flex-wrap">
                            <button type="submit"
                                className="flex-1 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                                {editingId ? '✏️ Update Entry' : '➕ Add Entry'}
                            </button>
                            <button type="button" onClick={addNewField}
                                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                ➕ Add Field
                            </button>
                            <button type="button" onClick={() => setShowApiConfig(true)}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                🔑 API Keys
                            </button>
                            {editingId && (
                                <button type="button" onClick={handleCancelEdit}
                                        className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                                    ❌ Cancel
                                </button>
                            )}
                        </div>
                    </form>
                )}

                {columns.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl mb-8">
                        <h3 className="text-xl font-semibold text-gray-700 mb-4">🚀 Get Started</h3>
                        <p className="text-gray-600 mb-6">Add your first field to begin</p>
                        <div className="flex justify-center gap-4 flex-wrap">
                            <button onClick={addNewField}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                ➕ Add First Field
                            </button>
                            <label className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                                📥 Import Data
                                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                            </label>
                        </div>
                    </div>
                )}

                {columns.length > 0 && (
                    <>
                        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex-1 min-w-64">
                                <input
                                    type="text"
                                    placeholder="🔍 Search entries..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={() => handleExport('csv')}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                                    📄 CSV
                                </button>
                                <button onClick={() => handleExport('json')}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
                                    📋 JSON
                                </button>
                                <div className="relative">
                                    <button onClick={() => setShowExportMenu(!showExportMenu)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                                        🚀 Export To Platform
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                                            <div className="p-2">
                                                <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">Export Destinations</h3>
                                                {exportOptions.map((option, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            option.action();
                                                            setShowExportMenu(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm text-white rounded-lg mb-1 hover:opacity-90 transition-opacity ${option.color}`}
                                                    >
                                                        {option.icon} {option.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer text-sm">
                                    📥 Import
                                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                                </label>
                                <button onClick={handleClearAll}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                                    🗑️ Clear All
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-inner overflow-hidden border border-gray-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            {columns.map(col => (
                                                <th key={col.key} 
                                                    onClick={() => handleSort(col.key)}
                                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                                                    {col.label} {sortField === col.key && (sortOrder === 'asc' ? '↑' : '↓')}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredAndSortedEntries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                                {columns.map(col => (
                                                    <td key={col.key} className="px-4 py-3 text-sm text-gray-800">
                                                        {entry[col.key] || ''}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-sm space-x-2">
                                                    <button onClick={() => handleEdit(entry)} 
                                                            className="text-blue-600 hover:text-blue-800 font-medium">
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => handleDelete(entry.id)} 
                                                            className="text-red-600 hover:text-red-800 font-medium">
                                                        🗑️ Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredAndSortedEntries.length === 0 && entries.length > 0 && (
                                            <tr>
                                                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-500">
                                                    🔍 No entries match your search
                                                </td>
                                            </tr>
                                        )}
                                        {entries.length === 0 && (
                                            <tr>
                                                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-500">
                                                    📝 No entries yet - add your first entry above!
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* Single Delete Confirmation Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 text-center">
                            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
                            <p className="text-gray-700 mb-6">Are you sure you want to delete this entry?</p>
                            <div className="flex gap-4">
                                <button onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={confirmDelete}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clear All Confirmation Modal */}
                {showDeleteAllModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 text-center">
                            <h3 className="text-lg font-semibold mb-4">Confirm Clear All</h3>
                            <p className="text-red-600 font-bold mb-6">This will delete ALL of your data permanently.</p>
                            <div className="flex gap-4">
                                <button onClick={() => setShowDeleteAllModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={confirmClearAll}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                    Clear All
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* API Configuration Modal */}
                {showApiConfig && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                            <h3 className="text-lg font-semibold mb-4">🔑 API Configuration</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Sheets API Key</label>
                                    <input
                                        type="password"
                                        value={apiKeys.googleSheets}
                                        onChange={(e) => saveApiKey('googleSheets', e.target.value)}
                                        placeholder="Enter Google Sheets API key"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Airtable API Key</label>
                                    <input
                                        type="password"
                                        value={apiKeys.airtable}
                                        onChange={(e) => saveApiKey('airtable', e.target.value)}
                                        placeholder="Enter Airtable API key"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Notion API Key</label>
                                    <input
                                        type="password"
                                        value={apiKeys.notion}
                                        onChange={(e) => saveApiKey('notion', e.target.value)}
                                        placeholder="Enter Notion integration token"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={() => setShowApiConfig(false)}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Save & Close
                                </button>
                            </div>
                            
                            <p className="text-xs text-gray-500 mt-3">
                                API keys are stored securely in your browser for privacy.
                            </p>
                        </div>
                    </div>
                )}
                
                {statusMessage && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                        <div className="bg-gray-800 text-white text-sm py-3 px-6 rounded-full shadow-lg">
                            {statusMessage}
                        </div>
                    </div>
                )}

                {showExportMenu && (
                    <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={() => setShowExportMenu(false)}></div>
                )}

                <div className="text-center mt-6 text-xs text-gray-400">
                    <p>User ID: {userId || 'N/A'}</p>
                </div>
            </div>
        </div>
    );
};

export default App;