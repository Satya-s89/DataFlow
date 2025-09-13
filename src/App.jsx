import React, { useState, useEffect } from 'react';

const App = () => {
    const [entries, setEntries] = useState([]);
    const [formInput, setFormInput] = useState({ name: '', email: '', phone: '', city: '' });
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('entries');
        if (saved) {
            setEntries(JSON.parse(saved));
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormInput(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const { name, email, phone, city } = formInput;
        if (!name.trim() && !email.trim() && !phone.trim() && !city.trim()) {
            return;
        }
        
        const newEntry = {
            id: Date.now(),
            ...formInput,
            createdAt: new Date().toISOString()
        };
        
        const newEntries = [...entries, newEntry];
        setEntries(newEntries);
        localStorage.setItem('entries', JSON.stringify(newEntries));
        setFormInput({ name: '', email: '', phone: '', city: '' });
    };

    const handleDelete = (id) => {
        const newEntries = entries.filter(entry => entry.id !== id);
        setEntries(newEntries);
        localStorage.setItem('entries', JSON.stringify(newEntries));
    };

    const handleCopy = () => {
        const header = ['"Full Name"', '"Email Address"', '"Phone Number"', '"City"'].join(',');
        const rows = entries.map(item => [
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.email || '').replace(/"/g, '""')}"`,
            `"${(item.phone || '').replace(/"/g, '""')}"`,
            `"${(item.city || '').replace(/"/g, '""')}"`,
        ].join(',')).join('\n');
        
        const dataToCopy = header + '\n' + rows;
        navigator.clipboard.writeText(dataToCopy).then(() => {
            setStatusMessage('Data copied to clipboard!');
            setTimeout(() => setStatusMessage(''), 2000);
        });
    };

    return (
        <div className="p-4 sm:p-8 flex items-center justify-center min-h-screen">
            <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-10 w-full max-w-2xl border border-gray-200">
                
                <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Data Entry Assistant</h1>
                    <p className="text-gray-600 text-sm sm:text-base mb-2">
                        Easily input and organize data. This tool saves your progress automatically.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input type="text" id="name" name="name" value={formInput.name} onChange={handleChange} placeholder="John Doe"
                               className="mt-1 block w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input type="email" id="email" name="email" value={formInput.email} onChange={handleChange} placeholder="john.doe@example.com"
                               className="mt-1 block w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input type="tel" id="phone" name="phone" value={formInput.phone} onChange={handleChange} placeholder="(123) 456-7890"
                               className="mt-1 block w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input type="text" id="city" name="city" value={formInput.city} onChange={handleChange} placeholder="New York"
                               className="mt-1 block w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                    </div>
                    
                    <button type="submit"
                            className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                        Add Entry
                    </button>
                </form>

                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Collected Data</h2>
                        <button onClick={handleCopy}
                                className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors text-sm">
                            Copy All Data
                        </button>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4 shadow-inner overflow-x-auto border border-gray-200">
                        <table className="min-w-full">
                            <thead className="bg-gray-200 rounded-lg">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg">Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-lg">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-100 transition-colors">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{entry.name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{entry.email}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{entry.phone}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{entry.city}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <button onClick={() => handleDelete(entry.id)} className="text-red-600 hover:text-red-800">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {statusMessage && (
                    <div className="fixed top-8 left-1/2 -translate-x-1/2 transition-opacity duration-300">
                        <div className="bg-gray-800 text-white text-sm py-2 px-4 rounded-full shadow-lg">
                            {statusMessage}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;