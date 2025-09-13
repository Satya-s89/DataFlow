import React, { useState, useEffect } from 'react';

const App = () => {
    const [entries, setEntries] = useState([]);
    const [formInput, setFormInput] = useState({});
    const [statusMessage, setStatusMessage] = useState('');
    const [userId, setUserId] = useState('local-user');
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [columns, setColumns] = useState([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState(null);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
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

    const saveToStorage = (data) => {
        try {
            localStorage.setItem('entries', JSON.stringify(data));
            updateColumns(data);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
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
                setStatusMessage(`✅ Field "${fieldName.trim()}" added!`);
                setTimeout(() => setStatusMessage(''), 2000);
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const hasData = Object.values(formInput).some(value => value && value.toString().trim());
        if (!hasData) {
            setStatusMessage('❌ Please enter some data');
            setTimeout(() => setStatusMessage(''), 2000);
            return;
        }
        
        try {
            if (editingId) {
                const newEntries = entries.map(entry => 
                    entry.id === editingId 
                        ? { ...entry, ...formInput, updatedAt: new Date().toISOString() }
                        : entry
                );
                setEntries(newEntries);
                saveToStorage(newEntries);
                setEditingId(null);
                setStatusMessage('✅ Entry updated!');
            } else {
                const newEntry = {
                    id: Date.now() + Math.random(),
                    ...formInput,
                    createdAt: new Date().toISOString()
                };
                const newEntries = [...entries, newEntry];
                setEntries(newEntries);
                saveToStorage(newEntries);
                setStatusMessage('✅ Entry added!');
            }
            
            const emptyForm = {};
            columns.forEach(col => { emptyForm[col.key] = ''; });
            setFormInput(emptyForm);
        } catch (error) {
            console.error('Error saving entry:', error);
            setStatusMessage('❌ Error saving entry!');
        }
        setTimeout(() => setStatusMessage(''), 2000);
    };

    const handleEdit = (entry) => {
        const editForm = {};
        columns.forEach(col => { editForm[col.key] = entry[col.key] || ''; });
        setFormInput(editForm);
        setEditingId(entry.id);
    };

    const handleCancelEdit = () => {
        const emptyForm = {};
        columns.forEach(col => { emptyForm[col.key] = ''; });
        setFormInput(emptyForm);
        setEditingId(null);
    };

    const handleDelete = (id) => {
        setEntryToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        try {
            const newEntries = entries.filter(entry => entry.id !== entryToDelete);
            setEntries(newEntries);
            saveToStorage(newEntries);
            setStatusMessage('✅ Entry deleted!');
        } catch (error) {
            console.error('Error deleting entry:', error);
            setStatusMessage('❌ Error deleting entry!');
        }
        setShowDeleteModal(false);
        setEntryToDelete(null);
        setTimeout(() => setStatusMessage(''), 2000);
    };

    const handleClearAll = () => {
        setShowDeleteAllModal(true);
    };

    const confirmClearAll = () => {
        try {
            setEntries([]);
            setColumns([]);
            setFormInput({});
            localStorage.removeItem('entries');
            setStatusMessage('✅ All entries cleared!');
        } catch (error) {
            console.error('Error clearing entries:', error);
            setStatusMessage('❌ Error clearing entries!');
        }
        setShowDeleteAllModal(false);
        setTimeout(() => setStatusMessage(''), 2000);
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
        const header = columns.map(col => `"${col.label}"`).join(',');
        const rows = filteredAndSortedEntries.map(item => 
            columns.map(col => `"${(item[col.key] || '').toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        return header + '\n' + rows;
    };

    const handleExport = (format) => {
        if (entries.length === 0) {
            setStatusMessage('❌ No data to export!');
            setTimeout(() => setStatusMessage(''), 2000);
            return;
        }
        
        let content, filename, type;
        
        if (format === 'csv') {
            content = generateCSV();
            filename = 'data-entries.csv';
            type = 'text/csv';
        } else {
            content = JSON.stringify(filteredAndSortedEntries, null, 2);
            filename = 'data-entries.json';
            type = 'application/json';
        }
        
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        setStatusMessage(`✅ Exported as ${format.toUpperCase()}!`);
        setTimeout(() => setStatusMessage(''), 2000);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data)) {
                    const importedEntries = data.map(item => ({
                        ...item,
                        id: Date.now() + Math.random(),
                        importedAt: new Date().toISOString()
                    }));
                    const newEntries = [...entries, ...importedEntries];
                    setEntries(newEntries);
                    saveToStorage(newEntries);
                    setStatusMessage(`✅ Imported ${data.length} entries!`);
                } else {
                    setStatusMessage('❌ Import failed - invalid file format!');
                }
            } catch (error) {
                console.error('Import failed:', error);
                setStatusMessage('❌ Import failed - invalid JSON format!');
            }
            setTimeout(() => setStatusMessage(''), 2000);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

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
                        Easily input, manage, and export your data with local storage.
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
                        
                        <div className="md:col-span-2 lg:col-span-3 flex gap-2">
                            <button type="submit"
                                className="flex-1 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                                {editingId ? '✏️ Update Entry' : '➕ Add Entry'}
                            </button>
                            <button type="button" onClick={addNewField}
                                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                ➕ Add Field
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
                        <div className="flex justify-center gap-4">
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
                                    📄 Export CSV
                                </button>
                                <button onClick={() => handleExport('json')}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
                                    📋 Export JSON
                                </button>
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
                
                {statusMessage && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                        <div className="bg-gray-800 text-white text-sm py-3 px-6 rounded-full shadow-lg">
                            {statusMessage}
                        </div>
                    </div>
                )}

                <div className="text-center mt-6 text-xs text-gray-400">
                    <p>User ID: {userId || 'N/A'}</p>
                </div>
            </div>
        </div>
    );
};

export default App;