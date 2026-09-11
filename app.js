import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
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
window.isEditing = false;
let editingLogId = null;

// ==========================================
// AUTHENTICATION & ROLE MANAGEMENT
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserEmail = user.email;
        isAdmin = (currentUserEmail === 'lakmalm@niwasa.com' || currentUserEmail === 'sulochana@niwasa.com' || currentUserEmail === 'admin@niwasa.lk');
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('currentUserDisplay').innerText = currentUserEmail;
        
        if(isAdmin) {
            document.getElementById('userRoleDisplay').innerText = "ADMIN (Data Entry)";
            document.getElementById('userRoleDisplay').classList.replace('bg-teal-700', 'bg-red-600');
            document.getElementById('adminMenu').classList.remove('hidden');
            
            if(document.getElementById('timeBlocksContainer').children.length === 0) {
                window.addTimeBlock();
            }
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
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        e.target.reset();
    } catch (error) {
        alert("Login Failed: Please check your Email and Password.");
    } finally { 
        btn.innerHTML = 'Sign In'; 
        btn.disabled = false;
    }
});
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));


// ==========================================
// DYNAMIC TIME BLOCKS LOGIC
// ==========================================
const timeBlocksContainer = document.getElementById('timeBlocksContainer');

window.addTimeBlock = function(ev = null) {
    const startVal = ev ? ev.start : '';
    const endVal = ev ? ev.end : '';
    const typeVal = ev ? ev.type : 'Work';
    const workersVal = ev ? ev.workers : '';

    const html = `
        <div class="flex flex-col sm:flex-row gap-2 items-center bg-white p-3 rounded border border-gray-200 shadow-sm time-block-row">
            <div class="flex gap-2 w-full sm:w-auto">
                <input type="time" class="time-start p-2 border rounded text-sm w-full" required value="${startVal}">
                <span class="self-center text-gray-400">to</span>
                <input type="time" class="time-end p-2 border rounded text-sm w-full" required value="${endVal}">
            </div>
            <select class="time-type p-2 border rounded text-sm w-full sm:w-auto" required>
                <option value="Work" ${typeVal === 'Work' ? 'selected' : ''}>Normal Work</option>
                <option value="Tea Break" ${typeVal === 'Tea Break' ? 'selected' : ''}>Tea Break</option>
                <option value="Lunch" ${typeVal === 'Lunch' ? 'selected' : ''}>Lunch Break</option>
                <option value="Weather" ${typeVal === 'Weather' ? 'selected' : ''}>Weather/Other Delay</option>
                <option value="OT" ${typeVal === 'OT' ? 'selected' : ''}>Overtime (OT)</option>
            </select>
            <input type="number" class="time-workers p-2 border rounded text-sm w-full sm:w-24" placeholder="Workers" required min="1" value="${workersVal}">
            <button type="button" class="delete-block-btn p-2 text-red-500 hover:bg-red-50 rounded transition">
                <i class="fas fa-trash pointer-events-none"></i>
            </button>
        </div>
    `;
    timeBlocksContainer.insertAdjacentHTML('beforeend', html);
}

document.getElementById('btnAddTimeBlock').addEventListener('click', () => window.addTimeBlock());

timeBlocksContainer.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-block-btn');
    if (deleteBtn) {
        deleteBtn.closest('.time-block-row').remove();
        calculateTotals(); 
    }
});

timeBlocksContainer.addEventListener('input', calculateTotals);
timeBlocksContainer.addEventListener('change', calculateTotals);

function getHoursDiff(start, end) {
    if(!start || !end) return 0;
    const [sh, sm] = start.split(':');
    const [eh, em] = end.split(':');
    let diff = (new Date(0,0,0,eh,em) - new Date(0,0,0,sh,sm)) / 3600000;
    if(diff < 0) diff += 24; 
    return diff;
}

function calculateTotals() {
    let tWork = 0, tBreak = 0, tOT = 0;
    const rows = document.querySelectorAll('.time-block-row');
    
    rows.forEach(row => {
        const start = row.querySelector('.time-start').value;
        const end = row.querySelector('.time-end').value;
        const type = row.querySelector('.time-type').value;
        const hours = getHoursDiff(start, end);
        
        if(type === 'Work') tWork += hours;
        else if(type === 'OT') tOT += hours;
        else tBreak += hours;
    });

    document.getElementById('lblTotalWork').innerText = tWork.toFixed(2) + 'h';
    document.getElementById('lblTotalBreak').innerText = tBreak.toFixed(2) + 'h';
    document.getElementById('lblTotalOT').innerText = tOT.toFixed(2) + 'h';
    
    return { workH: tWork, breakH: tBreak, otH: tOT };
}


// ==========================================
// ADMIN: SAVE / UPDATE FULL RECORD
// ==========================================
document.getElementById('laborForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const rows = document.querySelectorAll('.time-block-row');
    if(rows.length === 0) return alert("Please add at least one Time Block.");

    const btn = document.getElementById('saveRecordBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    let events = [];
    rows.forEach(row => {
        const start = row.querySelector('.time-start').value;
        const end = row.querySelector('.time-end').value;
        events.push({
            start: start,
            end: end,
            type: row.querySelector('.time-type').value,
            workers: parseInt(row.querySelector('.time-workers').value),
            duration: getHoursDiff(start, end).toFixed(2)
        });
    });

    const totals = calculateTotals();
    const totalTime = totals.workH + totals.breakH; 
    const efficiency = totalTime > 0 ? Math.round((totals.workH / totalTime) * 100) : 0;

    const data = {
        siteName: document.getElementById('recordSite').value,
        date: document.getElementById('recordDate').value,
        skilled: parseInt(document.getElementById('skilledCount').value),
        unskilled: parseInt(document.getElementById('unskilledCount').value),
        workHours: parseFloat(totals.workH.toFixed(2)),
        breakHours: parseFloat(totals.breakH.toFixed(2)),
        otHours: parseFloat(totals.otH.toFixed(2)),
        efficiency: efficiency,
        events: events, 
        adminNote: document.getElementById('adminNote').value
    };

    try {
        if(window.isEditing && editingLogId) {
            await updateDoc(doc(db, "laborLogs", editingLogId), data);
            alert("Record Updated Successfully!");
            window.cancelEdit(); 
        } else {
            data.viewerNotes = [];
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, "laborLogs"), data);
            
            document.getElementById('laborForm').reset();
            document.getElementById('recordDate').valueAsDate = new Date();
            document.getElementById('timeBlocksContainer').innerHTML = '';
            window.addTimeBlock(); 
            calculateTotals();
            alert("Record Saved Successfully!");
        }
        
        document.getElementById('nav-logs').click();
    } catch (error) {
        alert("Error saving record.");
        console.error(error);
    } finally {
        btn.innerHTML = window.isEditing ? 'Update Record' : 'Save Full Day Record';
        btn.disabled = false;
    }
});

window.cancelEdit = function() {
    window.isEditing = false;
    editingLogId = null;
    
    document.getElementById('formTitle').innerHTML = '<i class="fas fa-clipboard-check text-teal-600 mr-2"></i>CCTV Labor Log Entry';
    document.getElementById('saveRecordBtn').innerHTML = 'Save Full Day Record';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    document.getElementById('page-title').innerText = 'CCTV Data Entry';
    
    document.getElementById('laborForm').reset();
    document.getElementById('recordDate').valueAsDate = new Date();
    document.getElementById('timeBlocksContainer').innerHTML = '';
    window.addTimeBlock();
    calculateTotals();
};


// ==========================================
// ADMIN: EDIT & DELETE LOGIC (Fixing Event Bubbling)
// ==========================================
window.editLog = function(event, logId) {
    event.stopPropagation(); // Stop the card click from firing
    
    const log = allLogs.find(l => l.id === logId);
    if(!log) return;

    window.isEditing = true;
    editingLogId = log.id;

    document.getElementById('formTitle').innerHTML = '<i class="fas fa-edit text-teal-600 mr-2"></i>Edit Labor Record';
    document.getElementById('saveRecordBtn').innerHTML = 'Update Record';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    document.getElementById('page-title').innerText = 'Edit Record';

    document.getElementById('recordSite').value = log.siteName;
    document.getElementById('recordDate').value = log.date;
    document.getElementById('skilledCount').value = log.skilled;
    document.getElementById('unskilledCount').value = log.unskilled;
    document.getElementById('adminNote').value = log.adminNote || '';

    timeBlocksContainer.innerHTML = '';
    if(log.events && log.events.length > 0) {
        log.events.forEach(ev => { window.addTimeBlock(ev); });
    } else {
        window.addTimeBlock();
    }

    calculateTotals();
    document.getElementById('nav-addData').click();
};

window.deleteLog = async function(event, logId) {
    event.stopPropagation(); // Stop the card click from firing
    
    if(confirm("Are you sure you want to permanently delete this record?")) {
        try {
            await deleteDoc(doc(db, "laborLogs", logId));
            alert("Record Deleted Successfully.");
        } catch (error) {
            alert("Error deleting record.");
        }
    }
};


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

    let currentFilter = filterSite.value;
    filterSite.innerHTML = '<option value="ALL">All Sites</option>';
    uniqueSites.forEach(site => { filterSite.innerHTML += `<option value="${site}">${site}</option>`; });
    filterSite.value = currentFilter;

    window.renderLogs();
});

filterSite.addEventListener('change', window.renderLogs);

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
        let effColor = 'bg-teal-500';
        if(log.efficiency < 75) effColor = 'bg-yellow-500';
        if(log.efficiency < 50) effColor = 'bg-red-500';

        // PASSING 'event' TO THE FUNCTIONS TO PREVENT BUBBLING
        let adminActionsHTML = '';
        if (isAdmin) {
            adminActionsHTML = `
                <div class="bg-gray-100 p-2 flex justify-end gap-3 border-t items-center rounded-b-xl z-20 relative">
                    <button onclick="window.editLog(event, '${log.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-semibold px-2 py-1 transition"><i class="fas fa-edit mr-1"></i>Edit</button>
                    <button onclick="window.deleteLog(event, '${log.id}')" class="text-red-500 hover:text-red-700 text-sm font-semibold px-2 py-1 transition"><i class="fas fa-trash-alt mr-1"></i>Delete</button>
                </div>
            `;
        }

        container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition flex flex-col relative" onclick="window.openDetails('${log.id}')">
                <div class="bg-gray-50 p-4 border-b flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-gray-800 text-lg">${log.siteName}</h4>
                        <p class="text-sm text-gray-500"><i class="fas fa-calendar-alt mr-1"></i> ${log.date}</p>
                    </div>
                    <div class="text-right">
                        <span class="block text-3xl font-black ${effColor.replace('bg-', 'text-')}">${log.efficiency}%</span>
                        <span class="text-[10px] uppercase font-bold text-gray-400">Efficiency</span>
                    </div>
                </div>
                
                <div class="p-4 flex-1">
                    <div class="flex justify-between text-sm mb-3">
                        <div class="text-center w-1/3 border-r">
                            <p class="font-bold text-gray-800">${log.skilled + log.unskilled}</p>
                            <p class="text-xs text-gray-500">Labor</p>
                        </div>
                        <div class="text-center w-1/3 border-r">
                            <p class="font-bold text-teal-600">${log.workHours}h</p>
                            <p class="text-xs text-gray-500">Work</p>
                        </div>
                        <div class="text-center w-1/3">
                            <p class="font-bold text-purple-600">${log.otHours}h</p>
                            <p class="text-xs text-gray-500">OT</p>
                        </div>
                    </div>
                    <div class="text-center mt-3 pt-3 border-t">
                        <p class="text-sm text-blue-600 font-semibold">Click to view full timeline & details <i class="fas fa-arrow-right ml-1"></i></p>
                    </div>
                </div>
                
                ${adminActionsHTML}
            </div>
        `;
    });
};


// ==========================================
// DETAILS MODAL & VIEWER NOTES
// ==========================================
let activeLogIdForNote = null;

window.openDetails = function(logId) {
    const log = allLogs.find(l => l.id === logId);
    if(!log) return;
    
    activeLogIdForNote = log.id;
    
    document.getElementById('modalSiteTitle').innerHTML = `<i class="fas fa-clipboard-list mr-2"></i> ${log.siteName} - ${log.date}`;
    document.getElementById('modalWork').innerText = log.workHours + 'h';
    document.getElementById('modalBreak').innerText = log.breakHours + 'h';
    document.getElementById('modalOT').innerText = log.otHours + 'h';
    
    let effColor = 'text-teal-600';
    if(log.efficiency < 75) effColor = 'text-yellow-600';
    if(log.efficiency < 50) effColor = 'text-red-600';
    document.getElementById('modalEff').innerText = log.efficiency + '%';
    document.getElementById('modalEff').className = `text-xl sm:text-2xl font-black ${effColor}`;

    const tbody = document.getElementById('modalTimelineBody');
    tbody.innerHTML = '';
    if(log.events && log.events.length > 0) {
        log.events.forEach(ev => {
            let actColor = 'text-gray-700';
            if(ev.type === 'Work') actColor = 'text-teal-600 font-bold';
            else if(ev.type === 'OT') actColor = 'text-purple-600 font-bold';
            else actColor = 'text-orange-500';

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="p-2 font-medium">${ev.start} - ${ev.end}</td>
                    <td class="p-2 text-gray-500">${ev.duration}h</td>
                    <td class="p-2 ${actColor}">${ev.type}</td>
                    <td class="p-2 text-center font-semibold">${ev.workers}</td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-400">No detailed timeline available for this record.</td></tr>';
    }

    const adminDiv = document.getElementById('modalAdminNoteDiv');
    if(log.adminNote) {
        document.getElementById('modalAdminNote').innerText = log.adminNote;
        adminDiv.classList.remove('hidden');
    } else {
        adminDiv.classList.add('hidden');
    }

    const commentsDiv = document.getElementById('modalCommentsContainer');
    commentsDiv.innerHTML = '';
    if(log.viewerNotes && log.viewerNotes.length > 0) {
        log.viewerNotes.forEach(n => {
            const dateStr = new Date(n.addedAt).toLocaleString();
            commentsDiv.innerHTML += `
                <div class="bg-gray-50 p-3 rounded border border-gray-100">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-700"><i class="fas fa-user-circle mr-1"></i>${n.user}</span>
                        <span class="text-[10px] text-gray-400">${dateStr}</span>
                    </div>
                    <p class="text-gray-600">${n.text}</p>
                </div>
            `;
        });
    } else {
        commentsDiv.innerHTML = '<p class="text-gray-400 italic text-center py-2">No comments yet.</p>';
    }

    document.getElementById('viewerNoteText').value = '';
    document.getElementById('detailsModal').classList.remove('hidden');
};

window.submitViewerNote = async function() {
    const text = document.getElementById('viewerNoteText').value.trim();
    if(!text) return alert("Please type a comment.");

    try {
        const logRef = doc(db, "laborLogs", activeLogIdForNote);
        await updateDoc(logRef, {
            viewerNotes: arrayUnion({
                user: currentUserEmail.split('@')[0], 
                text: text,
                addedAt: new Date().toISOString()
            })
        });
        document.getElementById('viewerNoteText').value = '';
        document.getElementById('detailsModal').classList.add('hidden');
        alert("Comment added!");
    } catch (error) {
        alert("Failed to add comment.");
    }
};
