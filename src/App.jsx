import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, addDoc, onSnapshot, collection, query, deleteDoc } from 'firebase/firestore';

// DO NOT TOUCH: Global variables provided by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const App = () => {
    const [entries, setEntries] = useState([]);
    const [formInput, setFormInput] = useState({ name: '', email: '', phone: '', city: '' });
    const [statusMessage, setStatusMessage] = useState('');
    const [userId, setUserId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Effect to handle Firebase authentication and data fetching
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                // Listen for real-time data changes. Removed orderBy to prevent Firestore index errors.
                const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/entries`));
                
                const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                    const data = [];
                    snapshot.forEach((doc) => {
                        data.push({ id: doc.id, ...doc.data() });
                    });
                    setEntries(data);
                    setIsLoading(false);
                }, (error) => {
                    console.error("Error listening to Firestore changes:", error);
                    setIsLoading(false);
                });

                return () => unsubscribeSnapshot();
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
            }
        };

        handleAuth();

        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormInput(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { name, email, phone, city } = formInput;
        if (!name.trim() && !email.trim() && !phone.trim() && !city.trim()) {
            // Do not add empty entries
            return;
        }

        if (!userId) {
            console.error("User ID is not available.");
            return;
        }
        
        try {
            // Add a new document to Firestore
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/entries`), {
                ...formInput,
                createdAt: new Date(),
            });
            setFormInput({ name: '', email: '', phone: '', city: '' });
        } catch (error) {
            console.error("Error adding document:", error);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/entries`, id));
        } catch (error) {
            console.error("Error deleting document:", error);
        }
    };

    const handleCopy = () => {
        // More robust way to generate a CSV string
        const header = ['"Full Name"', '"Email Address"', '"Phone Number"', '"City"'].join(',');
        const rows = entries.map(item => [
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.email || '').replace(/"/g, '""')}"`,
            `"${(item.phone || '').replace(/"/g, '""')}"`,
            `"${(item.city || '').replace(/"/g, '""')}"`,
        ].join(',')).join('\n');
        
        const dataToCopy = header + '\n' + rows;

        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = dataToCopy;
        // Make the textarea invisible but selectable
        tempTextarea.style.position = 'absolute';
        tempTextarea.style.left = '-9999px';
        document.body.appendChild(tempTextarea);
        tempTextarea.focus();
        tempTextarea.select();

        try {
            document.execCommand('copy');
            setStatusMessage('Data copied to clipboard!');
            setTimeout(() => setStatusMessage(''), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        } finally {
            document.body.removeChild(tempTextarea);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600 text-lg">Loading...</div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 flex items-center justify-center min-h-screen">
            <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-10 w-full max-w-2xl border border-gray-200">
                
                {/* Title and User ID */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Data Entry Assistant</h1>
                    <p className="text-gray-600 text-sm sm:text-base mb-2">
                        Easily input and organize data. This tool saves your progress automatically.
                    </p>
                    <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full inline-block font-mono break-all">
                        User ID: {userId || 'N/A'}
                    </div>
                </div>

                {/* Data Entry Form */}
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

                {/* Data Display Section */}
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

                {/* Info/Status Message Box */}
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