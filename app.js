import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDtpKSpZi-0IOB_yBdPRt_CKQ_0-7McBss",
    authDomain: "niwasa-cost-analitics.firebaseapp.com",
    projectId: "niwasa-cost-analitics",
    storageBucket: "niwasa-cost-analitics.firebasestorage.app",
    messagingSenderId: "708635197914",
    appId: "1:708635197914:web:36e6e47ccad0707451c0e3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let allLogs = [];
let currentUserEmail = "";
let isAdmin = false;

// ==========================================
// AUTHENTICATION & ROLE MANAGEMENT
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserEmail = user.email;
        // Set Admin Emails here
        isAdmin = (currentUserEmail === 'sulochana@niwasa.com' || currentUserEmail === 'admin@niwasa.lk');
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('currentUserDisplay').innerText = currentUserEmail;
        
        if(isAdmin) {
            document.getElementById('userRoleDisplay').innerText = "ADMIN (Data Entry)";
            document.getElementById('userRoleDisplay').classList.replace('bg-teal-700', 'bg-red-600');
            document.getElementById('adminMenu').classList.remove('hidden');
        } else {
            document.getElementById('userRoleDisplay').innerText = "VIEWER";
            document.getElementById('adminMenu').classList.add('hidden');
        }
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        e.target.reset();
    } catch (error) {
        alert("Invalid credentials!");
    } finally { btn.innerHTML = 'Sign In'; }
});
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));


// ==========================================
// ADMIN: ADD LABOR RECORD
// ==========================================
document.getElementById('laborForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveRecordBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    const workH = parseFloat(document.getElementById('workHours').value);
    const breakH = parseFloat(document.getElementById('breakHours').value);
    const totalTime = workH + breakH;
    
    // Calculate Efficiency Percentage
    const efficiency = totalTime > 0 ? Math.round((workH / totalTime) * 100) : 0;

    const data = {
        siteName: document.getElementById('recordSite').value,
        date: document.getElementById('recordDate').value,
        skilled: parseInt(document.getElementById('skilledCount').value),
        unskilled: parseInt(document.getElementById('unskilledCount').value),
        workHours: workH,
        breakHours: breakH,
        otHours: parseFloat(document.getElementById('otHours').value),
        efficiency: efficiency,
        adminNote: document.getElementById('adminNote').value,
        viewerNotes: [], // Empty array for future comments
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "laborLogs"), data);
        document.getElementById('laborForm').reset();
        document.getElementById('recordDate').valueAsDate = new Date();
        alert("Record Saved Successfully!");
    } catch (error) {
        alert("Error saving record. Check permissions.");
    } finally {
        btn.innerHTML = 'Save Record';
        btn.disabled = false;
    }
});


// ==========================================
// VIEW: RENDER REPORTS & FILTER
// ==========================================
const filterSite = document.getElementById('filterSite');

onSnapshot(query(collection(db, "laborLogs"), orderBy("date", "desc")), (snapshot) => {
    allLogs = [];
    let uniqueSites = new Set();
    
    snapshot.forEach((docRef) => {
        const data = docRef.data();
        allLogs.push({ id: docRef.id, ...data });
        uniqueSites.add(data.siteName);
    });

    // Update Filter Dropdown
    let currentFilter = filterSite.value;
    filterSite.innerHTML = '<option value="ALL">All Sites</option>';
    uniqueSites.forEach(site => {
        filterSite.innerHTML += `<option value="${site}">${site}</option>`;
    });
    filterSite.value = currentFilter;

    window.renderLogs();
});

window.renderLogs = function() {
    const filter = filterSite.value;
    const container = document.getElementById('logsContainer');
    container.innerHTML = '';

    const filteredLogs = filter === 'ALL' ? allLogs : allLogs.filter(l => l.siteName === filter);

    if (filteredLogs.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">No records found.</div>`;
        return;
    }

    filteredLogs.forEach(log => {
        // Efficiency color coding
        let effColor = 'bg-green-500';
        if(log.efficiency < 75) effColor = 'bg-yellow-500';
        if(log.efficiency < 50) effColor = 'bg-red-500';

        // Render Viewer Notes
        let notesHTML = '';
        if(log.viewerNotes && log.viewerNotes.length > 0) {
            notesHTML = '<div class="mt-4 space-y-2 border-t pt-3">';
            log.viewerNotes.forEach(n => {
                notesHTML += `<div class="bg-gray-50 p-2 rounded text-sm"><span class="font-bold text-gray-700">${n.user}:</span> <span class="text-gray-600">${n.text}</span></div>`;
            });
            notesHTML += '</div>';
        }

        container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="bg-gray-50 p-4 border-b flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-gray-800">${log.siteName}</h4>
                        <p class="text-xs text-gray-500"><i class="fas fa-calendar-alt mr-1"></i> ${log.date}</p>
                    </div>
                    <div class="text-right">
                        <span class="block text-2xl font-black ${effColor.replace('bg-', 'text-')}">${log.efficiency}%</span>
                        <span class="text-[10px] uppercase font-bold text-gray-400">Efficiency</span>
                    </div>
                </div>
                
                <div class="p-4">
                    <div class="flex justify-between text-sm mb-3">
                        <div class="text-center w-1/3 border-r">
                            <p class="font-bold text-gray-800">${log.skilled + log.unskilled}</p>
                            <p class="text-xs text-gray-500">Total Labor</p>
                            <p class="text-[10px] text-gray-400 mt-1">(${log.skilled} Skilled / ${log.unskilled} Unskilled)</p>
                        </div>
                        <div class="text-center w-1/3 border-r">
                            <p class="font-bold text-blue-600">${log.workHours}h</p>
                            <p class="text-xs text-gray-500">Work Time</p>
                        </div>
                        <div class="text-center w-1/3">
                            <p class="font-bold text-orange-500">${log.breakHours}h</p>
                            <p class="text-xs text-gray-500">Break Time</p>
                        </div>
                    </div>
                    
                    ${log.otHours > 0 ? `<p class="text-xs text-purple-600 font-bold mb-2"><i class="fas fa-clock mr-1"></i> OT Recorded: ${log.otHours}h</p>` : ''}
                    ${log.adminNote ? `<p class="text-sm text-gray-600 bg-blue-50 p-2 rounded"><i class="fas fa-info-circle text-blue-400 mr-1"></i> ${log.adminNote}</p>` : ''}
                    
                    ${notesHTML}

                    <button onclick="openNoteModal('${log.id}')" class="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded text-sm transition">
                        <i class="fas fa-plus mr-1"></i> Add Comment / Reason
                    </button>
                </div>
            </div>
        `;
    });
};


// ==========================================
// ADDING VIEWER NOTES
// ==========================================
let activeLogIdForNote = null;

window.openNoteModal = function(logId) {
    activeLogIdForNote = logId;
    document.getElementById('viewerNoteText').value = '';
    document.getElementById('noteModal').classList.remove('hidden');
};

window.submitViewerNote = async function() {
    const text = document.getElementById('viewerNoteText').value.trim();
    if(!text) return alert("Please type a note.");

    try {
        const logRef = doc(db, "laborLogs", activeLogIdForNote);
        await updateDoc(logRef, {
            viewerNotes: arrayUnion({
                user: currentUserEmail.split('@')[0], // Shows 'sulochana' from sulochana@niwasa.com
                text: text,
                addedAt: new Date().toISOString()
            })
        });
        document.getElementById('noteModal').classList.add('hidden');
    } catch (error) {
        alert("Failed to add note.");
    }
};
