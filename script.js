import { handleLogin, handleLogout } from './auth.js';

import { db, auth } from './firebase.js';
import { 
    collection, 
    getDocs,  
    setDoc,   
    doc, 
    addDoc, 
    deleteDoc,
    query,    
    where,     
    runTransaction,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { writeBatch } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

const kpiDataAllRoles = [{"roleName":"Onboarding Team Lead","kpis":[{"name":"Go Live Rate","remarks":"No. of Accounts Go Live ≥ 10 txn / No. of Accounts in New Stage to Go Live Stage.","weightage":25,"maxRating":5,"inputType":"percentage","lowerIsBetter":false,"performanceBands":[{"gradeName":"Poor Performance","gradeValue":1,"condition":{"type":"percentage","operator":"lte","value":69}},{"gradeName":"Below Expectations","gradeValue":2,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":70,"upper":79}},{"gradeName":"Meets Expectations","gradeValue":3,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":80,"upper":90}},{"gradeName":"Exceeds Expectations","gradeValue":4,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":91,"upper":95}},{"gradeName":"Outstanding Performance","gradeValue":5,"condition":{"type":"percentage","operator":"gt","value":95}}]},{"name":"Installation SLA","remarks":"Installation conducted on merchant requested date.","weightage":20,"maxRating":5,"inputType":"percentage","lowerIsBetter":false,"performanceBands":[{"gradeName":"Poor Performance","gradeValue":1,"condition":{"type":"percentage","operator":"lte","value":79}},{"gradeName":"Below Expectations","gradeValue":2,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":80,"upper":84}},{"gradeName":"Meets Expectations","gradeValue":3,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":85,"upper":90}},{"gradeName":"Exceeds Expectations","gradeValue":4,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":91,"upper":95}},{"gradeName":"Outstanding Performance","gradeValue":5,"condition":{"type":"percentage","operator":"gt","value":95}}]},{"name":"Training Utilization Rate","remarks":"Total Monthly Slots for Training \\n= 1.75 trainings per day x 20 days x 5 OC \\n= 175 slots\\n\\nTotal Monthly Training (excluding Quick Guides) / Total Monthly Slots for Training \\n= Utilisation rate (%)","weightage":20,"maxRating":5,"inputType":"percentage","lowerIsBetter":false,"performanceBands":[{"gradeName":"Poor Performance","gradeValue":1,"condition":{"type":"percentage","operator":"lt","value":70}},{"gradeName":"Below Expectations","gradeValue":2,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":70,"upper":79}},{"gradeName":"Meets Expectations","gradeValue":3,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":80,"upper":90}},{"gradeName":"Exceeds Expectations","gradeValue":4,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":91,"upper":95}},{"gradeName":"Outstanding Performance","gradeValue":5,"condition":{"type":"percentage","operator":"gt","value":95}}]},{"name":"Onboarding CSAT","remarks":"CSAT survey related to onboarding.","weightage":25,"maxRating":5,"inputType":"percentage","lowerIsBetter":false,"performanceBands":[{"gradeName":"Poor Performance","gradeValue":1,"condition":{"type":"percentage","operator":"lt","value":69}},{"gradeName":"Below Expectations","gradeValue":2,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":70,"upper":79}},{"gradeName":"Meets Expectations","gradeValue":3,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":80,"upper":90}},{"gradeName":"Exceeds Expectations","gradeValue":4,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":91,"upper":95}},{"gradeName":"Outstanding Performance","gradeValue":5,"condition":{"type":"percentage","operator":"gt","value":95}}]},{"name":"First 30 Days Go Live Care Ticket ≤ 5","remarks":"Merchant ticket escalation related to onboarding after go live ≤ 5","weightage":10,"maxRating":5,"inputType":"percentage_compliance","lowerIsBetter":false,"comment":"Input is compliance % for '≤ 5 tickets'. Higher % is better.","performanceBands":[{"gradeName":"Poor Performance","gradeValue":1,"condition":{"type":"percentage","operator":"lte","value":74}},{"gradeName":"Below Expectations","gradeValue":2,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":75,"upper":79}},{"gradeName":"Meets Expectations","gradeValue":3,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":80,"upper":85}},{"gradeName":"Exceeds Expectations","gradeValue":4,"condition":{"type":"percentage","operator":"range_inclusive_inclusive","lower":86,"upper":90}},{"gradeName":"Outstanding Performance","gradeValue":5,"condition":{"type":"percentage","operator":"gte","value":91}}]}]},/* Rest of kpiDataAllRoles JSON */];
 
document.getElementById('login-button').addEventListener('click', handleLogin);
document.getElementById('logout-button').addEventListener('click', handleLogout);

// Listen for auth changes
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
  
    if (user && user.email.endsWith('@storehub.com')) {
      loginScreen.style.display = 'none';
      appContainer.style.display = 'block';
    } else {
      loginScreen.style.display = 'flex';
      appContainer.style.display = 'none';
    }
  });

// DOM Elements
const navCalculator = document.getElementById('nav-calculator');
const navEmployee = document.getElementById('nav-employee'); 
const navReport = document.getElementById('nav-report'); // New Report nav element
const navSettings = document.getElementById('nav-settings');
const calculatorSection = document.getElementById('calculator-section');
const employeeSection = document.getElementById('employee-section'); 
const reportSection = document.getElementById('report-section'); // New Report section element
const settingsSection = document.getElementById('settings-section');
// const calculatorContent = document.getElementById('calculator-section'); // This was a duplicate

// Add near other DOM Element getters
const navCompetencies = document.getElementById('nav-competencies');
const competenciesSection = document.getElementById('competencies-section');

// --- Global Data Stores ---
// Original kpiDataAllRoles is defined at the top of the script by the user.
// currentKpiData will be initialized by loadKpiData, which uses kpiDataAllRoles as a fallback.
let currentKpiData = []; 
let employeeData = [];
let performanceRecords = []; // For storing submitted KPI calculation records
let configurableInputTypes = []; // To store { value: string, label: string } objects

// Near other global data stores
let configurableDepartments = [];

// --- Global Helper Functions ---
function formatCondition(condition, kpiInputType) {
    if (!condition) return '-';
    
    // Use the enhanced getUnitForBandInput to determine the unit
    // The kpiInputType is the primary type for the KPI.
    // band.condition.type could be different if a band has a specific override type (though less common now with unitSymbol).
    const unit = getUnitForBandInput(kpiInputType, condition.type); 

    switch (condition.operator) {
        case 'lte': return `≤ ${condition.value}${unit}`;
        case 'lt': return `< ${condition.value}${unit}`;
        case 'gte': return `≥ ${condition.value}${unit}`;
        case 'gt': return `> ${condition.value}${unit}`;
        case 'eq': return `${condition.value}${unit}`;
        case 'range_inclusive_inclusive': return `${condition.lower}${unit} - ${condition.upper}${unit}`;
        default: return '-';
    }
}

// --- Navigation ---
function showSection(sectionToShow) {
    // Hide all sections, but only if they exist
    if (calculatorSection) calculatorSection.style.display = 'none';
    if (competenciesSection) competenciesSection.style.display = 'none'; 
    if (employeeSection) employeeSection.style.display = 'none';
    if (reportSection) reportSection.style.display = 'none';
    if (settingsSection) settingsSection.style.display = 'none';

    if (sectionToShow) {
        sectionToShow.style.display = 'block';
        console.log(`[showSection] Made section '${sectionToShow.id}' visible. Style: ${sectionToShow.style.display}`);
    } else {
        console.warn("[showSection] sectionToShow was null or undefined. No section displayed.");
        // if (calculatorSection) calculatorSection.style.display = 'block'; // Optionally default to a section
    }

    // Update active link - ensure nav elements exist before manipulating classList
    if (navCalculator) navCalculator.classList.remove('active');
    if (navCompetencies) navCompetencies.classList.remove('active');
    if (navEmployee) navEmployee.classList.remove('active');
    if (navReport) navReport.classList.remove('active');
    if (navSettings) navSettings.classList.remove('active');

    if (sectionToShow === calculatorSection && navCalculator) {
        navCalculator.classList.add('active');
    } else if (sectionToShow === competenciesSection && navCompetencies) {
        navCompetencies.classList.add('active');
    } else if (sectionToShow === employeeSection && navEmployee) {
        navEmployee.classList.add('active');
    } else if (sectionToShow === reportSection && navReport) {
        navReport.classList.add('active');
    } else if (sectionToShow === settingsSection && navSettings) {
        navSettings.classList.add('active');
    }
}

navCalculator.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(calculatorSection);
});

navEmployee.addEventListener('click', (e) => { 
    e.preventDefault();
    showSection(employeeSection);
    renderEmployeeSection(); 
});

navReport.addEventListener('click', (e) => { // Event listener for Report nav
    e.preventDefault();
    showSection(reportSection);
    renderReportSection(); // Call render function when section is shown
});

navSettings.addEventListener('click', (e) => {
    console.log('DEBUG: Settings NAV CLICKED'); // Targeted log
    e.preventDefault();
    showSection(settingsSection);
    renderSettings();
});

// Add new event listener for Competencies nav
if (navCompetencies) { // Check if element exists before adding listener
    navCompetencies.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(competenciesSection);
        renderCompetenciesSection(); 
    });
}

// --- KPI Calculator ---
function populateRoleSelector(dataSource) { // dataSource is currentKpiData
    let dynamicCalculatorContent = '';

    // --- Add Department Selector --- 
    dynamicCalculatorContent += '<div id="calculator-department-filter-container" style="margin-bottom: 15px;">';
    dynamicCalculatorContent += '<label for="calculator-department-select" style="margin-right: 5px;">Select Department:</label>';
    dynamicCalculatorContent += '<select id="calculator-department-select">';
    dynamicCalculatorContent += '<option value="">-- All Departments --</option>'; // Default option
    configurableDepartments.forEach(dept => {
        dynamicCalculatorContent += `<option value="${dept.id}">${dept.name}</option>`;
    });
    dynamicCalculatorContent += '</select></div>';

    // --- Role Selector (remains, but population will be affected by department) ---
    dynamicCalculatorContent += '<label for="role-select">Select Role:</label>';
    dynamicCalculatorContent += '<select id="role-select">';
    dynamicCalculatorContent += '<option value="">-- Select a Role --</option>'; 
    // Initial population of roles will be handled by the department select listener or initially show all if no dept selected
    // For initial load, let's show all roles since "All Departments" is default
    dataSource.forEach((role, index) => {
        dynamicCalculatorContent += `<option value="${index}">${role.roleName}</option>`;
    });
    dynamicCalculatorContent += '</select>';

    // Add Employee Selector (initially hidden or could be styled disabled)
    dynamicCalculatorContent += '<div id="employee-selector-container" style="margin-top: 15px; display: none;">';
    dynamicCalculatorContent += '<label for="employee-select">Select Employee:</label>';
    dynamicCalculatorContent += '<select id="employee-select"><option value="">-- Select an Employee --</option></select>';
    dynamicCalculatorContent += '</div>';

    // Add Performance Period Selector
    dynamicCalculatorContent += '<div id="period-selector-container" style="margin-top: 15px;">';
    dynamicCalculatorContent += '<label for="kpi-period-select">Performance Period:</label>';
    dynamicCalculatorContent += '<input type="month" id="kpi-period-select" style="margin-left: 5px;">';
    dynamicCalculatorContent += '</div>';

    dynamicCalculatorContent += '<div id="employee-details-display" style="margin-top: 10px; font-weight: bold;"></div>'; // For Employee ID and Role
    dynamicCalculatorContent += '<div id="kpi-table-container"></div>';
    dynamicCalculatorContent += '<div id="results-container"></div>';

    const calculatorSectionDiv = document.getElementById('calculator-section');
    // Clear previous dynamic content more carefully, preserving the h2 and initial p tag if they exist.
    // Assuming h2 is the first child and p is the second.
    while (calculatorSectionDiv.children.length > 2) { 
        calculatorSectionDiv.removeChild(calculatorSectionDiv.lastChild);
    }
    calculatorSectionDiv.insertAdjacentHTML('beforeend', dynamicCalculatorContent);

    // Set default value for month input to current month
    const periodSelectElement = document.getElementById('kpi-period-select');
    if (periodSelectElement) {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // JavaScript months are 0-indexed
        periodSelectElement.value = `${year}-${month}`;
    }

    const departmentSelectElement = document.getElementById('calculator-department-select');
    const roleSelectElement = document.getElementById('role-select');

    // Event listener for Department selection
    if (departmentSelectElement && roleSelectElement) {
        departmentSelectElement.addEventListener('change', (event) => {
            const selectedDeptId = event.target.value;
            // Clear subsequent selections and displays
            document.getElementById('employee-select').innerHTML = '<option value="">-- Select an Employee --</option>';
            document.getElementById('employee-selector-container').style.display = 'none';
            document.getElementById('kpi-table-container').innerHTML = '';
            document.getElementById('results-container').innerHTML = '';
            document.getElementById('employee-details-display').innerHTML = '';

            roleSelectElement.innerHTML = '<option value="">-- Select a Role --</option>'; // Reset roles

            let rolesToDisplay = [];
            if (selectedDeptId) { // A specific department is selected
                const selectedDept = configurableDepartments.find(d => d.id === selectedDeptId);
                if (selectedDept && selectedDept.assignedRoles) {
                    // Filter currentKpiData (dataSource) to get role objects matching assignedRole names
                    rolesToDisplay = dataSource.filter(roleObj => 
                        selectedDept.assignedRoles.includes(roleObj.roleName)
                    );
                }
            } else { // "-- All Departments --" is selected
                rolesToDisplay = dataSource; // Show all roles from the original dataSource (currentKpiData)
            }
            
            // Populate roles based on department selection
            rolesToDisplay.forEach(roleObj => {
                // Find the original index of this roleObj in the dataSource (currentKpiData)
                // This is important because the roleSelect value often refers to this original index.
                const originalIndex = dataSource.findIndex(r => r.roleName === roleObj.roleName);
                if (originalIndex !== -1) {
                    roleSelectElement.innerHTML += `<option value="${originalIndex}">${roleObj.roleName}</option>`;
                }
            });
        });
    }

    // Event listener for Role selection (remains largely the same, uses dataSource which is currentKpiData)
    if (roleSelectElement) {
        roleSelectElement.addEventListener('change', (event) => handleRoleSelection(event, dataSource));
    }
}

function handleRoleSelection(event, dataSource) {
    const selectedRoleIndex = event.target.value;
    const employeeSelectorContainer = document.getElementById('employee-selector-container');
    const employeeSelectElement = document.getElementById('employee-select');
    const kpiTableContainer = document.getElementById('kpi-table-container');
    const resultsContainer = document.getElementById('results-container');
    const employeeDetailsDisplay = document.getElementById('employee-details-display');

    // Clear previous state
    employeeSelectElement.innerHTML = '<option value="">-- Select an Employee --</option>';
    kpiTableContainer.innerHTML = '';
    resultsContainer.innerHTML = '';
    employeeDetailsDisplay.innerHTML = ''; // Clear employee details, period will be added by employee selection

    if (selectedRoleIndex === "") {
        employeeSelectorContainer.style.display = 'none';
        return;
    }

    const selectedRoleObject = dataSource[selectedRoleIndex];
    if (!selectedRoleObject) {
        console.error("Selected role object not found.");
        employeeSelectorContainer.style.display = 'none';
        return;
    }

    const employeesInRole = employeeData.filter(emp => emp.role === selectedRoleObject.roleName);

    if (employeesInRole.length > 0) {
        employeesInRole.forEach(emp => {
            employeeSelectElement.innerHTML += `<option value="${emp.id}">${emp.name} (${emp.id})</option>`;
        });
        employeeSelectorContainer.style.display = 'block';
        
        // Remove previous listener to avoid duplicates if any, then add new one
        const newEmployeeSelectElement = employeeSelectElement.cloneNode(true);
        employeeSelectElement.parentNode.replaceChild(newEmployeeSelectElement, employeeSelectElement);
        newEmployeeSelectElement.addEventListener('change', (e) => handleEmployeeSelection(e, selectedRoleObject, employeesInRole));

    } else {
        employeeSelectorContainer.style.display = 'block'; // Show the container to display the message
        employeeSelectElement.innerHTML = '<option value="">-- No employees for this role --</option>';
        // Optionally, display a more prominent message in kpiTableContainer or employeeDetailsDisplay
        kpiTableContainer.innerHTML = '<p style="color: orange;">No employees found assigned to this role. Please assign employees in the Employee section.</p>';
    }
}

function handleEmployeeSelection(event, selectedRoleObject, employeesInRole) {
    const selectedEmployeeId = event.target.value;
    const kpiTableContainer = document.getElementById('kpi-table-container');
    const resultsContainer = document.getElementById('results-container');
    const employeeDetailsDisplay = document.getElementById('employee-details-display');
    const periodSelectElement = document.getElementById('kpi-period-select'); // Get period selector

    kpiTableContainer.innerHTML = '';
    resultsContainer.innerHTML = '';
    employeeDetailsDisplay.innerHTML = '';

    if (selectedEmployeeId === "") {
        return;
    }

    const selectedEmployee = employeesInRole.find(emp => emp.id === selectedEmployeeId);
    const selectedPeriod = periodSelectElement ? periodSelectElement.value : 'N/A'; // Get selected period

    if (selectedEmployee && selectedRoleObject) {
        // Display employee details and period
        employeeDetailsDisplay.innerHTML = `
            <p><strong>Employee:</strong> ${selectedEmployee.name} (ID: ${selectedEmployee.id})</p>
            <p><strong>Role:</strong> ${selectedRoleObject.roleName}</p>
            <p><strong>Period:</strong> ${selectedPeriod ? selectedPeriod : 'Not Set'}</p>
        `;

        // Render KPI table for the selected role (as employee's role KPIs)
        renderKpiTable(selectedRoleObject, kpiTableContainer, resultsContainer, selectedRoleObject.roleName, selectedEmployee); 
    } else {
        console.error("Selected employee or role object not found.");
    }
}

function renderKpiTable(role, tableContainer, resultsContainer, roleName, employee = null) { // Added employee parameter
    let tableHeader = `<h3>KPIs for role: ${role.roleName}</h3>`;
    if (employee) {
        // This will now be handled by employeeDetailsDisplay, but keeping title simple here
        // tableHeader = `<h3>KPIs for: ${employee.name} (${employee.id}) - Role: ${role.roleName}</h3>`;
    }

    let tableHTML = `
        ${tableHeader} 
        <table>
            <thead>
                <tr>
                    <th>KPI</th>
                    <th>Weightage (%)</th>
                    <th>Poor (1)</th>
                    <th>Below (2)</th>
                    <th>Meets (3)</th>
                    <th>Exceeds (4)</th>
                    <th>Outstanding (5)</th>
                    <th>Actual Result</th>
                    <th>Sub Grade</th>
                    <th>Subtotal Score</th>
                </tr>
            </thead>
            <tbody>
    `;

    role.kpis.forEach((kpi, index) => {
        tableHTML += `
            <tr class="kpi-data-row">
                <td>${kpi.name}</td>
                <td>${kpi.weightage}</td>`;

        for (let i = 0; i < 5; i++) {
            if (kpi.performanceBands && kpi.performanceBands[i]) {
                tableHTML += `<td>${formatCondition(kpi.performanceBands[i].condition, kpi.inputType)}</td>`;
            } else {
                tableHTML += `<td>-</td>`;
            }
        }

        tableHTML += `
                <td><input type="number" class="actual-result" data-kpi-index="${index}" placeholder="Enter value" step="any"></td>
                <td id="sub-grade-${index}">-</td>
                <td id="subtotal-score-${index}">-</td>
            </tr>
        `;
        // New row for remarks
        if (kpi.remarks && kpi.remarks.trim() !== "") {
            tableHTML += `
                <tr class="kpi-remarks-row">
                    <td colspan="10" class="kpi-remarks-cell">
                        <strong>Remarks:</strong> ${kpi.remarks.replace(/\n/g, '<br>')}
                    </td>
                </tr>
            `;
        }
    });

    tableHTML += `
            </tbody>
        </table>
        <button id="calculate-button">Calculate Scores</button>
    `;
    tableContainer.innerHTML = tableHTML;

    document.getElementById('calculate-button').addEventListener('click', () => {
        calculateAllScores(role, resultsContainer, roleName);
    });
}

async function calculateAllScores(role, resultsContainer, roleName) {
    let totalScore = 0;
    const periodSelectElement = document.getElementById('kpi-period-select'); 
    const selectedPeriod = periodSelectElement ? periodSelectElement.value : 'N/A'; 

    // Details needed for submission
    const currentEmployeeId = document.getElementById('employee-select') ? document.getElementById('employee-select').value : null;
    const employeeDetailsText = document.getElementById('employee-details-display') ? document.getElementById('employee-details-display').innerText : '';
    let currentEmployeeName = 'N/A';
    const nameMatch = employeeDetailsText.match(/Employee: ([^\(]+) \(ID:/);
    if (nameMatch && nameMatch[1]) {
        currentEmployeeName = nameMatch[1].trim();
    }

    let kpiResultsForRecord = [];

    role.kpis.forEach((kpi, index) => {
        const actualResultInput = document.querySelector(`.actual-result[data-kpi-index='${index}']`);
        const actualResult = parseFloat(actualResultInput.value);
        let subGrade = 'N/A';
        let subtotalScore = 'N/A';

        if (isNaN(actualResult)) {
            document.getElementById(`sub-grade-${index}`).textContent = 'N/A';
            document.getElementById(`subtotal-score-${index}`).textContent = 'N/A';
            kpiResultsForRecord.push({
                name: kpi.name,
                weightage: kpi.weightage,
                actualResult: 'N/A',
                subGrade: 'N/A',
                subtotalScore: 'N/A'
            });
            return; 
        }
        
        subGrade = getSubGrade(actualResult, kpi, roleName);
        subtotalScore = (kpi.weightage / kpi.maxRating) * subGrade;
        totalScore += subtotalScore;

        document.getElementById(`sub-grade-${index}`).textContent = subGrade;
        document.getElementById(`subtotal-score-${index}`).textContent = subtotalScore.toFixed(2);

        kpiResultsForRecord.push({
            name: kpi.name,
            weightage: kpi.weightage,
            actualResult: actualResult,
            subGrade: subGrade,
            subtotalScore: parseFloat(subtotalScore.toFixed(2))
        });
    });

    // Add the submission button and logic
    resultsContainer.innerHTML = `
        <h3>Results</h3>
        <p><strong>For Period:</strong> ${selectedPeriod}</p>
        <p><strong>Total Score:</strong> ${totalScore.toFixed(2)}</p>
        <p><strong>Final Grade:</strong> ${getFinalGrade(totalScore)}</p>
        <button id="submit-kpi-record-button" style="margin-top: 15px; padding: 10px 15px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Submit Record</button>
    `;

    const submitButton = document.getElementById('submit-kpi-record-button');
    if (submitButton) {
        submitButton.addEventListener('click', async () => { // <-- Make this callback async
            if (!currentEmployeeId) {
                alert("No employee selected. Cannot submit record.");
                return;
            }

            // Check if a record for the selected period already exists locally (quick check)
            // For a more robust check, you might query Firestore, but this is a UI guard.
            const existingLocalRecord = performanceRecords.find(record => 
                record.roleName === roleName && 
                record.employeeId === currentEmployeeId && 
                record.period === selectedPeriod
            );

            if (existingLocalRecord) {
                alert(`A record for the period ${selectedPeriod} has already been submitted locally. If this is an error, check Firestore.`);
                return; // Prevent submission
            }

            const record = {
                // id: will be auto-generated by Firestore or use existing if re-saving, but addDoc is simpler for new.
                employeeId: currentEmployeeId,
                employeeName: currentEmployeeName,
                roleName: roleName,
                period: selectedPeriod,
                kpiDetails: kpiResultsForRecord,
                totalScore: parseFloat(totalScore.toFixed(2)),
                finalGrade: getFinalGrade(totalScore),
                submissionTimestamp: new Date().toISOString()
            };

            try {
                const docRef = await addDoc(collection(db, "performanceRecords"), record);
                console.log("Performance record submitted to Firestore with ID: ", docRef.id);
                performanceRecords.push({ ...record, id: docRef.id }); // Add to local array with Firestore ID
                alert('KPI Record Submitted to Firestore!');
                submitButton.textContent = 'Record Submitted';
                submitButton.disabled = true;
                submitButton.style.backgroundColor = '#aaa';
            } catch (error) {
                console.error("Error submitting performance record to Firestore: ", error);
                alert("Failed to submit KPI record. Please try again.");
            }
        });
    }
}

function getSubGrade(actualResult, kpi, roleName) {
    let normalizedActualResult = actualResult;

    if (kpi.name === "Average Completion Day ≤ 2 days" && roleName === "Merchant Success Manager") {
        // The logic here will handle cases where band units differ from main input type
    }

    for (const band of kpi.performanceBands) {
        let checkValue = normalizedActualResult;
        
        let bandLower = band.condition.lower;
        let bandUpper = band.condition.upper;
        let bandSingleValue = band.condition.value;

        if (kpi.inputType === "duration_days" && band.condition.type === "duration_hours") {
            if (band.condition.lower !== undefined) bandLower = band.condition.lower / 24;
            if (band.condition.upper !== undefined) bandUpper = band.condition.upper / 24;
            if (band.condition.value !== undefined) bandSingleValue = band.condition.value / 24;
        }
        else if (kpi.inputType === "duration_minutes" && band.condition.type === "duration_hours") {
            if (band.condition.lower !== undefined) bandLower = band.condition.lower * 60;
            if (band.condition.upper !== undefined) bandUpper = band.condition.upper * 60;
            if (band.condition.value !== undefined) bandSingleValue = band.condition.value * 60;
        }

        let conditionMet = false;
        if (kpi.lowerIsBetter) {
            switch (band.condition.operator) {
                case "lte": conditionMet = checkValue <= bandSingleValue; break;
                case "lt": conditionMet = checkValue < bandSingleValue; break;
                case "gte": conditionMet = checkValue >= bandSingleValue; break;
                case "gt": conditionMet = checkValue > bandSingleValue; break;
                case "eq": conditionMet = checkValue === bandSingleValue; break;
                case "range_inclusive_inclusive":
                    conditionMet = checkValue >= bandLower && checkValue <= bandUpper;
                    break;
            }
        } else {
            switch (band.condition.operator) {
                case "lte": conditionMet = checkValue <= bandSingleValue; break;
                case "lt": conditionMet = checkValue < bandSingleValue; break;
                case "gte": conditionMet = checkValue >= bandSingleValue; break;
                case "gt": conditionMet = checkValue > bandSingleValue; break;
                case "eq": conditionMet = checkValue === bandSingleValue; break;
                case "range_inclusive_inclusive":
                    conditionMet = checkValue >= bandLower && checkValue <= bandUpper;
                    break;
            }
        }
        if (conditionMet) return band.gradeValue;
    }
    return 0;
}

function getFinalGrade(totalScore) {
    if (totalScore >= 85) return "Outstanding Performance";
    if (totalScore >= 75) return "Exceeds Expectations";
    if (totalScore >= 60) return "Meets Expectations";
    if (totalScore >= 40) return "Below Expectations";
    return "Poor Performance";
}

// --- Settings ---
// REMOVE: let currentKpiData = JSON.parse(JSON.stringify(kpiDataAllRoles)); from here

async function loadKpiData() { // MADE ASYNC
    console.log('[loadKpiData] Called. Checking kpiDataAllRoles:', typeof kpiDataAllRoles);
    const configDocRef = doc(db, 'kpiConfiguration', 'main');

    try {
        const docSnap = await getDoc(configDocRef);
        if (docSnap.exists()) {
            const firestoreConfig = docSnap.data().data; // Assuming data is stored under a 'data' field
            if (Array.isArray(firestoreConfig) && firestoreConfig.length > 0 && firestoreConfig[0].roleName) {
                currentKpiData = firestoreConfig;
                console.log('[loadKpiData] Loaded KPI configuration from Firestore.');
                // Optionally, update localStorage for offline or faster initial non-critical display?
                // For full migration, we avoid localStorage here.
                // localStorage.setItem('kpiAppData', JSON.stringify(currentKpiData)); 
                return;
            } else {
                console.warn('[loadKpiData] KPI data in Firestore is not in the expected format. Using defaults and attempting to overwrite.');
            }
        } else {
            console.log('[loadKpiData] No KPI configuration found in Firestore. Initializing with kpiDataAllRoles.');
        }
    } catch (error) {
        console.error('[loadKpiData] Error loading KPI configuration from Firestore:', error, 'Using defaults.');
    }

    // Fallback to kpiDataAllRoles if Firestore load failed or data was missing/invalid
    if (typeof kpiDataAllRoles !== 'undefined') {
        currentKpiData = JSON.parse(JSON.stringify(kpiDataAllRoles));
        // Attempt to save this default/fallback configuration to Firestore for next time
        try {
            await setDoc(configDocRef, { data: currentKpiData });
            console.log('[loadKpiData] Saved default kpiDataAllRoles to Firestore.');
            // localStorage.setItem('kpiAppData', JSON.stringify(currentKpiData)); // Save to LS as well if preferred
        } catch (saveError) {
            console.error('[loadKpiData] Error saving default KPI configuration to Firestore:', saveError);
        }
    } else {
        console.error('[loadKpiData] CRITICAL: kpiDataAllRoles is undefined and Firestore load failed. KPI data will be empty.');
        currentKpiData = [];
        // localStorage.setItem('kpiAppData', JSON.stringify(currentKpiData)); 
    }
}

async function persistKpiSettings() { // MADE ASYNC for Firestore
    try {
        await setDoc(doc(db, 'kpiConfiguration', 'main'), { data: currentKpiData });
        alert('Settings saved to Firestore!');
        // localStorage.removeItem('kpiAppData'); // Optionally remove old localStorage key
    } catch (error) {
        console.error('Error saving KPI settings to Firestore:', error);
        alert('Error saving settings. Please try again.');
    }

    if (document.getElementById('role-select')) { 
        populateRoleSelector(currentKpiData); 
    }
}

function renderSettings() {
    console.log('DEBUG: renderSettings FUNCTION CALLED'); 
    console.log("[renderSettings] Called"); 
    const settingsContent = document.getElementById('settings-section');
    console.log('[renderSettings] settingsContent element:', settingsContent);

    const existingH2 = settingsContent.querySelector('h2');
    const existingP = settingsContent.querySelector('p');
    console.log('[renderSettings] existingH2:', existingH2, 'existingP:', existingP);
    
    settingsContent.innerHTML = ''; 
    console.log('[renderSettings] settingsContent after innerHTML = "":', settingsContent.innerHTML);

    if(existingH2) settingsContent.appendChild(existingH2);
    if(existingP) settingsContent.appendChild(existingP);
    console.log('[renderSettings] settingsContent after appending existing H2/P:', settingsContent.innerHTML);

    let settingsViewHTML = `
        <div style="margin-bottom: 20px;">
            <label for="setting-type-select" style="margin-right: 5px;">Edit:</label>
            <select id="setting-type-select">
                <option value="">-- Select Setting Type --</option>
                <option value="weightages">Weightages</option>
                <option value="performanceBands">Performance Bands, Names & Descriptions</option>
                <option value="roleSetup">Role Setup</option>
                <option value="inputTypeSetup">Input Type Setup</option> <!-- ADDED THIS LINE -->
                <option value="departmentSetup">Department Setup</option> <!-- ADD THIS -->
                <option value="competencySetup">Competency Setup</option>
            </select>
        </div>
        <div id="role-filter-container" style="margin-top: 15px; display: none;">
            <label for="settings-role-select" style="margin-right: 5px;">Filter by Role:</label>
            <select id="settings-role-select"></select>
        </div>
        <div id="specific-settings-container" style="margin-top: 20px;">
            <!-- Content will be managed by displaySettingInputs or set initially below -->
        </div>
        <button id="save-settings-button" style="margin-top: 20px; padding: 10px 15px;">Save All Modifiable Settings</button>
    `;
    console.log('[renderSettings] Generated settingsViewHTML:', settingsViewHTML); 

    settingsContent.insertAdjacentHTML('beforeend', settingsViewHTML);
    console.log('[renderSettings] settingsContent after insertAdjacentHTML:', settingsContent.innerHTML); 

    const settingTypeSelect = document.getElementById('setting-type-select');
    const roleFilterContainer = document.getElementById('role-filter-container');
    const settingsRoleSelect = document.getElementById('settings-role-select');
    const specificSettingsContainer = document.getElementById('specific-settings-container');
    console.log('[renderSettings] specificSettingsContainer element:', specificSettingsContainer);

    if (settingTypeSelect && settingTypeSelect.value === '' && specificSettingsContainer) {
        specificSettingsContainer.innerHTML = '<p style="padding:10px; background-color:#f0f0f0; border:1px solid #ddd; border-radius:4px;">Please select a setting type from the dropdown above to begin editing.</p>';
        console.log('[renderSettings] specificSettingsContainer after setting initial message:', specificSettingsContainer.innerHTML); 
    } else if (specificSettingsContainer) {
        console.log('[renderSettings] Initial message NOT set. settingTypeSelect value:', settingTypeSelect ? settingTypeSelect.value : 'N/A');
    }

    if (settingTypeSelect) {
        settingTypeSelect.addEventListener('change', (event) => {
            const selectedType = event.target.value;
            console.log("[renderSettings] Setting type dropdown changed to:", selectedType);
            if (selectedType === 'weightages' || selectedType === 'performanceBands') {
                roleFilterContainer.style.display = 'block';
                populateRoleFilterDropdown(selectedType, settingsRoleSelect);
                const currentSelectedRole = settingsRoleSelect.value;
                displaySettingInputs(selectedType, currentSelectedRole === 'all' || currentSelectedRole === '' ? null : parseInt(currentSelectedRole));
            } else if (selectedType === 'roleSetup' || selectedType === 'inputTypeSetup' || selectedType === 'departmentSetup' || selectedType === 'competencySetup') { // Modified condition
                roleFilterContainer.style.display = 'none'; 
                displaySettingInputs(selectedType, null);
            } else { 
                roleFilterContainer.style.display = 'none';
                displaySettingInputs(selectedType, null); 
            }
        });
    }

    if (settingsRoleSelect) {
        settingsRoleSelect.addEventListener('change', (event) => {
            const selectedRoleIdx = event.target.value;
            const currentSettingType = settingTypeSelect.value;
            const roleIdx = selectedRoleIdx === 'all' || selectedRoleIdx === '' ? null : parseInt(selectedRoleIdx);
            displaySettingInputs(currentSettingType, roleIdx); 
        });
    }

    const saveSettingsButton = document.getElementById('save-settings-button');
    if (saveSettingsButton) {
        saveSettingsButton.addEventListener('click', () => {
            const selectedType = document.getElementById('setting-type-select') ? document.getElementById('setting-type-select').value : null;
            let settingsSaved = false;
            if (selectedType === 'weightages') {
                saveWeightageSettings(); 
                settingsSaved = true;
            } else if (selectedType === 'performanceBands') {
                saveEditableSettingsDetails(); 
                settingsSaved = true;
            }

            if (settingsSaved) {
                persistKpiSettings(); 
            } else if (selectedType === 'roleSetup'){
                alert("Role setup changes are saved automatically. KPI definitions are edited within 'Setup KPIs'.");
            } else if (selectedType === 'inputTypeSetup') {
                alert("Input Type changes are saved automatically upon add/delete.");
            } else if (selectedType === 'departmentSetup') { // ADD THIS ELSE IF
                alert("Department changes are saved automatically upon add/edit/delete.");
            } else if (selectedType === 'competencySetup') {
                alert("Competency Setup changes are saved automatically...");
            } else {
                alert("Please select a setting type (Weightages or Performance Bands) to save specific modifications. Role setup and Input Type changes are saved automatically.");
            }
        });
    }

    // Explicitly ensure the main settings section is visible after all content is rendered.
    settingsContent.style.display = 'block'; 
    settingsSection.style.display = 'block'; // Redundant if settingsContent is settingsSection, but safe.
    console.log('[renderSettings] END: Explicitly set settingsContent display:', settingsContent.style.display);
}

function populateRoleFilterDropdown(selectedSettingType, roleSelectElement) {
    console.log("[populateRoleFilterDropdown] Called for setting type:", selectedSettingType);
    if (!roleSelectElement) {
        console.error("[populateRoleFilterDropdown] Role select element not found!");
        return;
    }
    roleSelectElement.innerHTML = '<option value=\"all\">-- Show All Roles --</option>'; // Default option
    currentKpiData.forEach((role, index) => {
        roleSelectElement.innerHTML += `<option value=\"${index}\">${role.roleName}</option>`;
    });
    console.log("[populateRoleFilterDropdown] Roles populated.");
}

function displaySettingInputs(settingType, selectedRoleIndex = null) { 
    const container = document.getElementById('specific-settings-container');
    if (!container) { console.error("[displaySettingInputs] Error: specific-settings-container not found."); return; }
    
    container.innerHTML = ''; 

    if (settingType === 'weightages') {
        renderWeightageSettingsForm(container, selectedRoleIndex);
    } else if (settingType === 'performanceBands') {
        renderPerformanceBandsSettingsForm(container, selectedRoleIndex);
    } else if (settingType === 'roleSetup') { 
        renderRoleSetupForm(container);
    } else if (settingType === 'inputTypeSetup') { 
        renderInputTypeSetupForm(container); // Initial call, no editModeData
    } else if (settingType === 'departmentSetup') { // ADD THIS CASE
        renderDepartmentSetupForm(container);
    } else if (settingType === 'competencySetup') {
        renderCompetencySetupPage(container);
    } else { 
        container.innerHTML = '<p style="padding:10px; background-color:#f0f0f0; border:1px solid #ddd; border-radius:4px;">Please select a setting type from the dropdown above to begin editing.</p>';
    }
}

// MANUALLY REPLACE your existing renderWeightageSettingsForm function with this:
function renderWeightageSettingsForm(container, roleFilterIndex = null) {
    console.log("[renderWeightageSettingsForm] Called with roleFilterIndex:", roleFilterIndex);
    let formHTML = '<h3>Edit KPI Weightages</h3>';
    
    const roleIndicesToIterate = roleFilterIndex !== null && currentKpiData[roleFilterIndex]
        ? [roleFilterIndex] // User selected a specific role to filter by
        : currentKpiData.map((_, idx) => idx); // Show all roles

    if (roleIndicesToIterate.length === 0 && roleFilterIndex !== null) {
        // This case handles if a role was selected that somehow has no data (e.g., just added, no KPIs)
        // Or if currentKpiData is empty and a filter was attempted (less likely)
         const selectedRoleName = currentKpiData[roleFilterIndex] ? currentKpiData[roleFilterIndex].roleName : "Selected Role";
         formHTML += `<p style="font-style:italic; margin-top:10px;">No KPIs found for role: ${selectedRoleName}. Add KPIs in 'Role Setup'.</p>`;
    } else if (currentKpiData.length === 0) {
        formHTML += `<p style="font-style:italic; margin-top:10px;">No roles or KPIs configured yet. Please set them up in 'Role Setup'.</p>`;
    }


    roleIndicesToIterate.forEach(originalRoleIndex => {
        const role = currentKpiData[originalRoleIndex];
        if (!role) {
            console.warn(`[renderWeightageSettingsForm] Role not found for index: ${originalRoleIndex}`);
            return; // Should not happen if roleIndicesToIterate is derived correctly
        }

        // Only add role header if there are KPIs to show or if it's the explicitly filtered role
        if (role.kpis && role.kpis.length > 0 || roleFilterIndex === originalRoleIndex) {
            formHTML += `<h4 style="margin-top:20px; margin-bottom:10px; color:#1a252f; padding-bottom:5px; border-bottom:1px solid #ddd;">Role: ${role.roleName}</h4>`;
            if (!role.kpis || role.kpis.length === 0) {
                 formHTML += `<p style="font-style:italic; margin-left:10px;">No KPIs defined for this role yet.</p>`;
            }
        }


        (role.kpis || []).forEach((kpi, kpiIndex) => {
            // Updated HTML structure for horizontal layout
            formHTML += `
                <div class="kpi-weightage-setting-item" style="display: flex; align-items: center; margin-bottom: 8px; padding: 10px; background-color: #f8f9fa; border-radius:4px; border: 1px solid #e9ecef;">
                    <label for="weightage-${originalRoleIndex}-${kpiIndex}" style="flex-grow: 1; margin-right: 10px; margin-bottom:0; font-weight:normal; color:#333;">${kpi.name}:</label>
                    <input type="number" class="setting-weightage" 
                           id="weightage-${originalRoleIndex}-${kpiIndex}" 
                           value="${kpi.weightage}" 
                           data-role-idx="${originalRoleIndex}" 
                           data-kpi-idx="${kpiIndex}" 
                           min="0" max="100" step="1" 
                           style="width: 80px; /* Adjusted width */ padding: 8px; margin-bottom:0; text-align:right; border: 1px solid #ced4da; border-radius: .25rem;"> 
                    <span style="margin-left: 8px; font-weight:bold; color:#555;">%</span>
                </div>`;
        });
    });

    if (roleIndicesToIterate.length === 0 && roleFilterIndex === null && currentKpiData.length > 0) {
        // This handles the case where "Show All Roles" is selected, but no roles actually have KPIs.
        // The individual role iteration wouldn't have added role headers.
        formHTML += `<p style="font-style:italic; margin-top:10px;">No KPIs found across any roles. Add KPIs in 'Role Setup'.</p>`;
    }
    
    container.innerHTML = formHTML;
}

// renderPerformanceBandsSettingsForm will also need roleFilterIndex
// MANUALLY REPLACE your existing renderPerformanceBandsSettingsForm function with this:
function renderPerformanceBandsSettingsForm(container, roleFilterIndex = null) {
    console.log("[renderPerformanceBandsSettingsForm] Called with roleFilterIndex:", roleFilterIndex);
    if (!container) { console.error("Container not found for performance band settings."); return; }
    
    let formHTML = '<h3>Edit Performance Bands, KPI Names & Descriptions</h3>';
    if (!currentKpiData || currentKpiData.length === 0) {
        formHTML += '<p style="font-style:italic; margin-top:10px;">No KPI data configured. Please set up roles and KPIs first in \'Role Setup\'.</p>';
        container.innerHTML = formHTML;
        return;
    }

    const roleIndicesToIterate = roleFilterIndex !== null && currentKpiData[roleFilterIndex]
        ? [roleFilterIndex]
        : currentKpiData.map((_, idx) => idx);
    
    let foundKpisToDisplay = false; // Flag to check if any KPIs are rendered

    roleIndicesToIterate.forEach(originalRoleIndex => {
        const role = currentKpiData[originalRoleIndex];
        if (!role) {
            console.warn(`[renderPerformanceBandsSettingsForm] Role not found for index: ${originalRoleIndex}`);
            return;
        }

        if (!role.kpis || role.kpis.length === 0) {
            if (roleFilterIndex === originalRoleIndex) { // Only show message if this specific role was filtered and has no KPIs
                 formHTML += `<h4 style="margin-top: 20px; margin-bottom: 10px; color:#1a252f; padding-bottom:5px; border-bottom:1px solid #ddd;">Role: ${role.name}</h4>`;
                 formHTML += `<p style="margin-left:10px; font-style:italic;">No KPIs defined for this role. Add them in 'Role Setup'.</p>`;
                 foundKpisToDisplay = true; // We displayed something (a message for this role)
            }
            return; 
        }
        
        foundKpisToDisplay = true; // KPIs will be displayed for this role
        formHTML += `<h4 style="margin-top: 20px; margin-bottom: 10px; color:#1a252f; padding-bottom:5px; border-bottom:1px solid #ddd;">Role: ${role.roleName}</h4>`;
        role.kpis.forEach((kpi, kpiIndex) => {
            const rIdx = originalRoleIndex; 
            const kIdx = kpiIndex;

            formHTML += `<div class="kpi-settings-block" style="margin-left: 10px; margin-bottom: 25px; padding: 15px; background-color: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">`;
            // KPI Name and Description editing parts
            formHTML += `<div style="margin-bottom: 8px;">
                            <h5 id="kpi-name-display-${rIdx}-${kIdx}" class="kpi-name-text" 
                                data-role-idx="${rIdx}" data-kpi-idx="${kIdx}" 
                                title="Click to edit KPI name" style="cursor: pointer; display: inline-block; margin-right: 5px; font-size: 1.1em; color: #0056b3;">
                                ${kpi.name}
                            </h5>
                            <span style="font-size:0.85em; color: #555;">(Type: ${kpi.inputType})</span>
                            <input type="text" id="kpi-name-input-${rIdx}-${kIdx}" class="kpi-name-input" 
                                   data-role-idx="${rIdx}" data-kpi-idx="${kIdx}" 
                                   value="${kpi.name}" 
                                   style="display:none; width: 70%; margin-bottom: 3px; padding: 6px; border:1px solid #aaa; border-radius:4px; font-size:1em;"/>
                         </div>`;
            formHTML += `<div style="margin-bottom: 15px;">
                            <strong style="display: block; margin-bottom: 4px; font-size:0.95em;">Description (Remarks):</strong>
                            <div id="remarks-display-${rIdx}-${kIdx}" class="remarks-text" 
                                 data-role-idx="${rIdx}" data-kpi-idx="${kIdx}" 
                                 title="Click to edit description" style="cursor: pointer; padding: 8px; border: 1px dashed #ccc; min-height: 35px; background-color: white; border-radius:4px; font-size:0.9em; color:#444;">
                                ${kpi.remarks.replace(/\n/g, '<br>') || '<em style="color:#777">No description. Click to add.</em>'}
                            </div>
                            <textarea id="remarks-input-${rIdx}-${kIdx}" class="remarks-kpi-input" 
                                      data-role-idx="${rIdx}" data-kpi-idx="${kIdx}" 
                                      style="display:none; width: 98%; min-height: 70px; margin-top:5px; padding:8px; border:1px solid #aaa; border-radius:4px; font-size:0.9em;"
                                      >${kpi.remarks}</textarea>
                         </div>`;

            formHTML += '<div style="margin-left: 10px; margin-bottom: 10px;">'; 
            formHTML += `<strong style="font-size:0.95em; color:#333; display:block; margin-bottom:8px;">Performance Bands:</strong>`;
            kpi.performanceBands.forEach((band, bandIndex) => {
                const bIdx = bandIndex;
                formHTML += `<div class="band-edit-item" style="margin-bottom: 12px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; background-color: #ffffff;">`;
                formHTML += `<strong style="font-size:0.9em;">${band.gradeName} (Grade ${band.gradeValue}):</strong> `;
                formHTML += `<span style="font-size: 0.85em; color: #555; display:block; margin-bottom:8px;">Current: ${formatCondition(band.condition, kpi.inputType)}</span>`;
                formHTML += `<div class="band-inputs" style="margin-top: 5px;">`;
                const unit = getUnitForBandInput(kpi.inputType, band.condition.type);
                
                if (band.condition.operator === 'range_inclusive_inclusive') {
                    formHTML += `
                        <div style="display: flex; align-items: center; flex-wrap:wrap; gap:15px;">
                            <div style="display: flex; align-items: center;">
                                <label for="pb-lower-${rIdx}-${kIdx}-${bIdx}" style="margin-right: 5px; margin-bottom:0; font-weight:normal; font-size:0.9em;">Lower:</label>
                                <input type="number" step="any" class="performance-band-input" id="pb-lower-${rIdx}-${kIdx}-${bIdx}" data-role-idx="${rIdx}" data-kpi-idx="${kIdx}" data-band-idx="${bIdx}" data-condition-key="lower" value="${band.condition.lower !== undefined ? band.condition.lower : ''}" style="width: 80px; padding: 6px; margin-bottom:0; text-align:right; border: 1px solid #ced4da; border-radius: .25rem; font-size:0.9em;">
                                <span style="margin-left: 3px; font-weight:normal; font-size:0.9em;">${unit}</span>
                            </div>
                            <div style="display: flex; align-items: center;">
                                <label for="pb-upper-${rIdx}-${kIdx}-${bIdx}" style="margin-right: 5px; margin-bottom:0; font-weight:normal; font-size:0.9em;">Upper:</label>
                                <input type="number" step="any" class="performance-band-input" id="pb-upper-${rIdx}-${kIdx}-${bIdx}" data-role-idx="${rIdx}" data-kpi-idx="${kIdx}" data-band-idx="${bIdx}" data-condition-key="upper" value="${band.condition.upper !== undefined ? band.condition.upper : ''}" style="width: 80px; padding: 6px; margin-bottom:0; text-align:right; border: 1px solid #ced4da; border-radius: .25rem; font-size:0.9em;">
                                <span style="margin-left: 3px; font-weight:normal; font-size:0.9em;">${unit}</span>
                            </div>
                        </div>`; 
                } else { // Handles lte, gte, eq, lt, gt
                    formHTML += `
                        <div style="display: flex; align-items: center;">
                            <label for="pb-value-${rIdx}-${kIdx}-${bIdx}" style="margin-right: 5px; margin-bottom:0; font-weight:normal; font-size:0.9em;">Target:</label>
                            <input type="number" step="any" class="performance-band-input" 
                                   id="pb-value-${rIdx}-${kIdx}-${bIdx}" 
                                   data-role-idx="${rIdx}" data-kpi-idx="${kIdx}" data-band-idx="${bIdx}" data-condition-key="value" 
                                   value="${band.condition.value !== undefined ? band.condition.value : ''}" 
                                   style="width: 80px; padding: 6px; margin-bottom:0; text-align:right; border: 1px solid #ced4da; border-radius: .25rem; font-size:0.9em;">
                            <span style="margin-left: 5px; font-weight:normal; font-size:0.9em;">${unit}</span>
                        </div>`;
                }
                formHTML += `</div></div>`; 
            });
            formHTML += '</div>'; 
            formHTML += '</div>'; 
        });
    });

    if (!foundKpisToDisplay && roleFilterIndex === null && currentKpiData.length > 0) {
        formHTML += `<p style="font-style:italic; margin-top:10px;">No KPIs found for any roles. Add KPIs in 'Role Setup'.</p>`;
    } else if (!foundKpisToDisplay && roleFilterIndex === null && currentKpiData.length === 0) {
        // This case is already handled by the initial check of currentKpiData.length
    }


    container.innerHTML = formHTML;
    
    document.querySelectorAll('.kpi-name-text').forEach(nameDisplay => { 
        nameDisplay.addEventListener('click', () => {
            const rIdx = nameDisplay.dataset.roleIdx;
            const kIdx = nameDisplay.dataset.kpiIdx;
            const inputId = `kpi-name-input-${rIdx}-${kIdx}`;
            const correspondingInput = document.getElementById(inputId);
            nameDisplay.style.display = 'none';
            if (correspondingInput) {
                correspondingInput.style.display = 'inline-block';
                correspondingInput.focus();
            }
        });
    });
    document.querySelectorAll('.remarks-text').forEach(remarksDiv => { 
        remarksDiv.addEventListener('click', () => {
            const rIdx = remarksDiv.dataset.roleIdx;
            const kIdx = remarksDiv.dataset.kpiIdx;
            const inputId = `remarks-input-${rIdx}-${kIdx}`;
            const correspondingInput = document.getElementById(inputId);
            remarksDiv.style.display = 'none';
            if (correspondingInput) {
                correspondingInput.style.display = 'block';
                correspondingInput.focus();
            }
        });
    });
}

function saveWeightageSettings() {
    document.querySelectorAll('.setting-weightage').forEach(input => {
        const rIdx = parseInt(input.dataset.roleIdx);
        const kIdx = parseInt(input.dataset.kpiIdx);
        const newWeightage = parseFloat(input.value);
        if (!isNaN(newWeightage) && newWeightage >= 0 && newWeightage <= 100) {
            currentKpiData[rIdx].kpis[kIdx].weightage = newWeightage;
        } else {
            alert(`Invalid weightage for ${currentKpiData[rIdx].kpis[kIdx].name}. Please enter a number between 0 and 100.`);
            // Optionally, revert input to original value or handle error more gracefully
            input.value = currentKpiData[rIdx].kpis[kpiIdx].weightage; // Revert
        }
    });
    console.log('Weightage settings prepared for saving.');
}

function saveEditableSettingsDetails() {
    let allValid = true;
    // Save Performance Band Inputs (existing logic)
    document.querySelectorAll('.performance-band-input').forEach(input => {
        const roleIdx = parseInt(input.dataset.roleIdx);
        const kpiIdx = parseInt(input.dataset.kpiIdx);
        const bandIdx = parseInt(input.dataset.bandIdx);
        const conditionKey = input.dataset.conditionKey;
        const newValue = parseFloat(input.value);

        if (isNaN(newValue)) {
            allValid = false;
            const roleName = currentKpiData[roleIdx]?.roleName || `Role ${roleIdx + 1}`;
            const kpiName = currentKpiData[roleIdx]?.kpis[kpiIdx]?.name || `KPI ${kpiIdx + 1}`;
            const bandName = currentKpiData[roleIdx]?.kpis[kpiIdx]?.performanceBands[bandIdx]?.gradeName || `Band ${bandIdx + 1}`;
            alert(`Invalid input for ${bandName} of KPI '${kpiName}' in role '${roleName}'. Please enter a valid number.`);
            const originalBand = kpiDataAllRoles[roleIdx]?.kpis[kpiIdx]?.performanceBands[bandIdx];
            if (originalBand && originalBand.condition[conditionKey] !== undefined) {
                input.value = originalBand.condition[conditionKey];
            } else {
                 const currentBandCond = currentKpiData[roleIdx]?.kpis[kpiIdx]?.performanceBands[bandIdx]?.condition;
                 if (currentBandCond && currentBandCond[conditionKey] !== undefined) {
                    input.value = currentBandCond[conditionKey];
                 } else {
                    input.value = ''; // Fallback if cannot determine original/current
                 }
            }
            return; 
        }
        if (currentKpiData[roleIdx]?.kpis[kpiIdx]?.performanceBands[bandIdx]?.condition) {
            currentKpiData[roleIdx].kpis[kpiIdx].performanceBands[bandIdx].condition[conditionKey] = newValue;
        } else {
            console.error("Could not find data structure for performance band:", {roleIdx, kpiIdx, bandIdx, conditionKey});
            allValid = false; 
        }
    });

    // Save KPI Remarks
    document.querySelectorAll('.remarks-kpi-input').forEach(textarea => {
        // Only update if the textarea was made visible (i.e., was interacted with)
        // Or, more simply, just update all, as their default value is the current remark.
        const roleIdx = parseInt(textarea.dataset.roleIdx);
        const kpiIdx = parseInt(textarea.dataset.kpiIdx);
        const newRemarks = textarea.value;

        if (currentKpiData[roleIdx]?.kpis[kpiIdx]) {
            currentKpiData[roleIdx].kpis[kpiIdx].remarks = newRemarks;
        } else {
            console.error("Could not find data structure for KPI remarks:", {roleIdx, kpiIdx});
            // This scenario is less likely if the form is generated from currentKpiData
            allValid = false; 
        }
    });

    // NEW: Save KPI Names
    document.querySelectorAll('.kpi-name-input').forEach(input => {
        const roleIdx = parseInt(input.dataset.roleIdx);
        const kpiIdx = parseInt(input.dataset.kpiIdx);
        const newKpiName = input.value.trim(); // Trim whitespace

        if (!newKpiName) { // Basic validation: KPI name should not be empty
            allValid = false;
            const roleName = currentKpiData[roleIdx]?.roleName || `Role ${roleIdx + 1}`;
            alert(`KPI name for one of the KPIs in role '${roleName}' cannot be empty. Changes to this KPI name were not saved.`);
            // Revert to original name if possible
            input.value = currentKpiData[roleIdx]?.kpis[kpiIdx]?.name || kpiDataAllRoles[roleIdx]?.kpis[kpiIdx]?.name || '';
            return; // Skip this one
        }

        if (currentKpiData[roleIdx]?.kpis[kpiIdx]) {
            currentKpiData[roleIdx].kpis[kpiIdx].name = newKpiName;
        } else {
            console.error("Could not find data structure for KPI name:", {roleIdx, kpiIdx});
            allValid = false; 
        }
    });

    if (allValid) {
        console.log('Editable settings (bands, remarks, KPI names) prepared for saving.');
    } else {
        console.warn('Some editable settings were invalid or could not be saved. Please check console.');
    }
}

// --- Initialization ---
const initialKpiData = JSON.parse(JSON.stringify(kpiDataAllRoles));

document.addEventListener('DOMContentLoaded', async () => { // Make this async
    // ...
    await loadKpiData(); // ADDED await, as loadKpiData is now async
    await loadEmployeeData(); // <<<< MAKE SURE THIS IS CALLED AND AWAITED
    await loadPerformanceRecords(); // If async
    await loadInputTypes(); // If async
    await loadDepartments(); // If async
    await loadCompetencyCategories(); // If async
    
    showSection(calculatorSection); 
    populateRoleSelector(currentKpiData); 
    
    // Call renderEmployeeSection AFTER data is loaded if it depends on employeeData
    // If renderEmployeeSection itself calls renderEmployeeList which uses employeeData,
    // then employeeData must be populated before renderEmployeeSection is called.
    renderEmployeeSection(); 
});

// --- Employee Data Management ---
async function addEmployee(empData) {
    console.log("[addEmployee] empData:", empData);
  
    // 1. Check uniqueness outside of transaction
    const employeesCol = collection(db, "employees");
    const uniquenessQuery = query(
      employeesCol,
      where("employeeCode", "==", empData.employeeCode)
    );
    console.log("[addEmployee] checking uniqueness with query:", uniquenessQuery);
  
    const existingSnap = await getDocs(uniquenessQuery);
    if (!existingSnap.empty) {
      throw new Error(`Employee code ${empData.employeeCode} already exists`);
    }
  
    // 2. Now run a transaction just to write the new doc
    const newDocRef = doc(employeesCol); // auto-ID
    console.log("[addEmployee] newDocRef:", newDocRef);
  
    await runTransaction(db, async (tx) => {
      tx.set(newDocRef, empData);
    });
  
    console.log("[addEmployee] Employee added at:", newDocRef.path);
    return { ...empData, id: newDocRef.id };
  }

  async function loadEmployeeData() {
    try {
      const snapshot = await getDocs(collection(db, 'employees'));
      employeeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Employees loaded:', employeeData);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  }


// Save/Update a SINGLE employee in Firestore
async function saveEmployee(employeeObject) {
    if (!employeeObject.id) {
        console.error("Attempting to save employee without an ID for setDoc:", employeeObject);
        alert("Error: Cannot save employee without an ID.");
        return null;
    }
    try {
        await setDoc(doc(db, "employees", employeeObject.id), employeeObject);
        console.log('Employee saved/updated in Firestore:', employeeObject.id);
        // Optional: Update local array if this function is called directly after a local modification
        // For example, if you modify an employee object and then call saveEmployee(modifiedEmp)
        const index = employeeData.findIndex(emp => emp.id === employeeObject.id);
        if (index !== -1) {
            employeeData[index] = employeeObject;
        } else {
            // This case should ideally not happen if ID exists, implies inconsistency
            employeeData.push(employeeObject); 
        }
        return employeeObject;
    } catch (error) {
        console.error('Error saving employee to Firestore:', error);
        return null;
    }
}


// Delete a SINGLE employee from Firestore AND the local employeeData array
async function deleteEmployee(employeeId) {
    try {
        await deleteDoc(doc(db, "employees", employeeId));
        employeeData = employeeData.filter(emp => emp.id !== employeeId); 
        console.log('Employee deleted from Firestore:', employeeId);
    } catch (error) {
        console.error('Error deleting employee from Firestore:', error);
    }
}

// --- End of Firestore Employee Data Management Functions ---

// --- Render Employee Section (Initial) ---
function renderEmployeeSection() {
    console.log("[renderEmployeeSection] Called");
    const employeeListContainerId = 'employee-list-container';
    const addEditFormContainerId = 'add-edit-employee-form-container';

    employeeSection.innerHTML = `
        <h2>Employee Management</h2>
        <p>Manage employee details, assign roles, and view their information.</p>
        
        <div id="employee-filters" style="margin-bottom: 20px; padding: 10px; background-color: #f0f0f0; border-radius: 5px;">
            <h4 style="margin-top:0; margin-bottom:10px;">Filter Employees:</h4>
            <div style="margin-bottom: 5px;">
                <label for="employee-role-filter" style="margin-right: 5px; min-width:120px; display:inline-block;">Search by Role:</label>
                <input type="text" id="employee-role-filter" placeholder="Enter role..." style="padding: 5px; width: calc(100% - 150px);">
            </div>
            <div style="margin-bottom: 5px;">
                <label for="employee-name-filter" style="margin-right: 5px; min-width:120px; display:inline-block;">Search by Name:</label>
                <input type="text" id="employee-name-filter" placeholder="Enter name..." style="padding: 5px; width: calc(100% - 150px);">
            </div>
            <div> <!-- Added Department Filter Input -->
                <label for="employee-department-filter" style="margin-right: 5px; min-width:120px; display:inline-block;">Search by Dept:</label>
                <input type="text" id="employee-department-filter" placeholder="Enter department..." style="padding: 5px; width: calc(100% - 150px);">
            </div>
        </div>

        <button id="add-new-employee-button" style="margin-bottom: 10px;">Add New Employee</button>
        <div id="${addEditFormContainerId}" style="display: none; margin-bottom: 20px; padding:15px; border: 1px solid #ccc; background-color:#f8f8f8; border-radius: 5px;">
        </div>
        <div id="${employeeListContainerId}" style="margin-top: 10px;">
        </div>
    `;

    const listContainer = document.getElementById(employeeListContainerId);
    const roleFilterInput = document.getElementById('employee-role-filter');
    const nameFilterInput = document.getElementById('employee-name-filter');
    const departmentFilterInput = document.getElementById('employee-department-filter'); // Get new filter input
    const addEditFormDiv = document.getElementById(addEditFormContainerId);

    renderEmployeeList(listContainer); 

    if (roleFilterInput) {
        roleFilterInput.addEventListener('input', () => renderEmployeeList(listContainer));
    }
    if (nameFilterInput) {
        nameFilterInput.addEventListener('input', () => renderEmployeeList(listContainer));
    }
    if (departmentFilterInput) { // Add event listener for department filter
        departmentFilterInput.addEventListener('input', () => renderEmployeeList(listContainer));
    }

    document.getElementById('add-new-employee-button').addEventListener('click', () => {
        renderAddEditEmployeeForm(addEditFormDiv, null, listContainer); 
    });
}

// This is your existing function, modified:
function renderEmployeeList(container) {
    if (!container) { console.error("[renderEmployeeList] Container not found."); return; }

    const roleFilterValue = document.getElementById('employee-role-filter') ? 
                            document.getElementById('employee-role-filter').value.toLowerCase() : '';
    const nameFilterValue = document.getElementById('employee-name-filter') ? 
                            document.getElementById('employee-name-filter').value.toLowerCase() : '';
    const departmentFilterValue = document.getElementById('employee-department-filter') ? 
                                  document.getElementById('employee-department-filter').value.toLowerCase() : '';

    console.log(`[renderEmployeeList] Filters - Role: '${roleFilterValue}', Name: '${nameFilterValue}', Dept: '${departmentFilterValue}'`);

    let filteredEmployees = employeeData; // employeeData is now sourced from Firestore via loadEmployeeData

    if (roleFilterValue) {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.role && emp.role.toLowerCase().includes(roleFilterValue)
        );
    }
    if (nameFilterValue) {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.name && emp.name.toLowerCase().includes(nameFilterValue)
        );
    }
    if (departmentFilterValue) { 
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.department && emp.department.toLowerCase().includes(departmentFilterValue)
        );
    }

    container.innerHTML = ''; 

    if (filteredEmployees.length === 0) {
        if (roleFilterValue || nameFilterValue || departmentFilterValue) {
            container.innerHTML = '<p>No employees match the current filter criteria.</p>';
        } else {
            container.innerHTML = '<p>No employees found. Click \'Add New Employee\' to begin.</p>';
        }
        return;
    }

    let listHTML = '<ul id="existing-employees-list" style="list-style: none; padding: 0;">';
    filteredEmployees.forEach((employee) => {
        // IMPORTANT: We use employee.id (from Firestore) directly now.
        // The originalIndex logic might be less reliable if the main employeeData array
        // is re-ordered or if IDs are not perfectly managed. Using employee.id is safer.
        
        listHTML += `
            <li style="margin-bottom: 10px; padding: 15px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 5px;">
                <div><strong>ID:</strong> ${employee.id}</div>
                <div><strong>Name:</strong> ${employee.name}</div>
                <div><strong>Role:</strong> ${employee.role}</div>
                <div><strong>Department:</strong> ${employee.department || 'N/A'}</div>
                <div class="employee-actions" style="margin-top: 10px;">
                    <button class="edit-employee-button" data-employee-id="${employee.id}" style="margin-right: 8px;">Edit</button>
                    <button class="delete-employee-button" data-employee-id="${employee.id}" style="background-color: #e74c3c; color: white;">Delete</button>
                </div>
            </li>
        `;
    });
    listHTML += '</ul>';
    container.innerHTML = listHTML;

    // EDIT BUTTON LOGIC
    document.querySelectorAll('.edit-employee-button').forEach(button => {
        button.addEventListener('click', (event) => {
          // Grab the Firestore document ID directly
          const employeeIdToEdit = event.target.dataset.employeeId;
          if (!employeeIdToEdit) {
            alert("Error: Missing employee ID for editing.");
            return;
          }
      
          // Pass the document ID (string) into your render function
          const formContainer = document.getElementById('add-edit-employee-form-container');
          renderAddEditEmployeeForm(formContainer, employeeIdToEdit, /* optional container */ document.getElementById('employee-list-container'));
        });
      });

    // DELETE BUTTON LOGIC (MODIFIED)
    document.querySelectorAll('.delete-employee-button').forEach(button => {
        button.addEventListener('click', async (event) => { // <--- Make this async
            const employeeIdToDelete = event.target.dataset.employeeId;
            const employeeToDelete = employeeData.find(emp => emp.id === employeeIdToDelete); // Find by ID

            if (!employeeToDelete) {
                alert("Error: Could not find employee to delete.");
                return;
            }

            if (confirm(`Are you sure you want to delete employee "${employeeToDelete.name}" (ID: ${employeeToDelete.id})?`)) {
                // NEW WAY (Firestore):
                await deleteEmployee(employeeIdToDelete); // Deletes from Firestore and local array
                
                // No need to call loadEmployeeData() here if deleteEmployee correctly updates the local array
                // and you only want to re-render based on the modified local array.
                // If you want to be absolutely sure and fetch fresh from Firestore:
                // await loadEmployeeData();
                
                renderEmployeeList(container); // Re-render the list from the (now updated) local employeeData
                alert(`Employee "${employeeToDelete.name}" deleted successfully.`);
            }
        });
    });
}

// --- Performance Record Management ---
async function loadPerformanceRecords() {
    performanceRecords = []; // Clear local array
    try {
        const querySnapshot = await getDocs(collection(db, "performanceRecords"));
        querySnapshot.forEach((docSnap) => {
            performanceRecords.push({ id: docSnap.id, ...docSnap.data() });
        });
        console.log('Performance records loaded from Firestore:', performanceRecords.length, 'records');
    } catch (error) {
        console.error('Error loading performance records from Firestore:', error);
        performanceRecords = []; // Reset on error
    }
}

// --- Report Section ---
// PLACE THIS FUNCTION BEFORE renderReportSection


function renderReportSection() {
    console.log("[renderReportSection] Called");

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
    const defaultEndPeriod = `${currentYear}-${currentMonth}`;
    let threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startYear = threeMonthsAgo.getFullYear();
    const startMonth = (threeMonthsAgo.getMonth() + 1).toString().padStart(2, '0');
    const defaultStartPeriod = `${startYear}-${startMonth}`;
    const defaultSingleMonthPeriod = defaultEndPeriod;

    let reportSectionHTML = `
        <div id="report-type-selector" style="margin-bottom: 20px; padding: 10px; background-color: #e9e9e9; border-radius: 5px;">
            <label for="report-type-select" style="margin-right: 10px; font-weight: bold;">Select Report Type:</label>
            <select id="report-type-select" style="padding: 5px; min-width: 250px;">
                <option value="" selected>-- Select Report Type --</option>
                <option value="individual">Individual Employee Report</option>
                <option value="roleComparison">Role Performance Comparison</option>
                <option value="competencyReport">Employee Competency Report</option>
            </select>
        </div>

        <div id="general-report-filters" style="padding: 15px; background-color: #e0e0e0; border-radius: 5px; margin-bottom: 20px; display: none;">
            <h4 style="margin-top:0; margin-bottom:10px;">Individual Report Period Range:</h4>
            <label for="report-start-period" style="margin-right: 5px;">Start Period:</label>
            <input type="month" id="report-start-period" value="${defaultStartPeriod}" style="margin-right: 15px;">
            <label for="report-end-period" style="margin-right: 5px;">End Period:</label>
            <input type="month" id="report-end-period" value="${defaultEndPeriod}">
        </div>
        
        <div id="individual-report-filters" style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; display: none;">
            <h4 style="margin-top:0; margin-bottom:15px;">Individual Employee Report Filters:</h4>
            <div style="margin-bottom: 10px;">
                <label for="report-role-select">Filter by Role:</label>
                <select id="report-role-select" style="margin-right: 15px; min-width: 200px;"><option value="">-- Select Role --</option></select>
            </div>
            <div>
                <label for="report-employee-select">Filter by Employee:</label>
                <select id="report-employee-select" style="min-width: 200px;" disabled><option value="">-- Select Employee --</option></select>
            </div>
        </div>

        <div id="role-comparison-filters" style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; display: none;">
            <h4 style="margin-top:0; margin-bottom:15px;">Role Performance Comparison Filters:</h4>
            <div style="margin-bottom: 10px;">
                <label for="role-comparison-role-select">Select Role to Compare:</label>
                <select id="role-comparison-role-select" style="min-width: 200px;"><option value="">-- Select Role --</option></select>
            </div>
            <div>
                <label for="role-comparison-period-select">Select Period for Comparison:</label>
                <input type="month" id="role-comparison-period-select" value="${defaultSingleMonthPeriod}">
            </div>
        </div>

        <div id="competency-report-filters" style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; display: none;">
            <h4 style="margin-top:0; margin-bottom:15px;">Employee Competency Report Filters:</h4>
            <div style="margin-bottom: 10px;">
                <label for="competency-report-department-select">Filter by Department:</label>
                <select id="competency-report-department-select" style="padding:5px; min-width: 220px;">
                    <option value="">-- All Departments --</option>
                </select>
            </div>
            <div>
                <label for="competency-report-role-select">Filter by Role:</label>
                <select id="competency-report-role-select" style="padding:5px; min-width: 220px;">
                    <option value="">-- All Roles --</option>
                </select>
            </div>
        </div>
        <div id="report-display-area" style="margin-top: 20px;">
            {/* Content will be dynamically rendered here */}
        </div>
    `;

    const reportSectionContainer = document.getElementById('report-section'); 
    if (!reportSectionContainer) {
        console.error("[renderReportSection] CRITICAL: Main report section container (id='report-section') not found! Aborting render.");
        return;
    }
    const existingH2 = reportSectionContainer.querySelector('h2');
    const existingP = reportSectionContainer.querySelector('p');
    reportSectionContainer.innerHTML = ''; 
    if (existingH2) reportSectionContainer.appendChild(existingH2);
    if (existingP) reportSectionContainer.appendChild(existingP);
    reportSectionContainer.insertAdjacentHTML('beforeend', reportSectionHTML);
    console.log("[renderReportSection] reportSectionHTML inserted into reportSectionContainer.");

    // Getters for all filter elements
    const reportTypeSelect = document.getElementById('report-type-select');
    console.log("[renderReportSection] reportTypeSelect element:", reportTypeSelect);
    const generalReportFiltersDiv = document.getElementById('general-report-filters');
    console.log("[renderReportSection] generalReportFiltersDiv element:", generalReportFiltersDiv);
    const individualFiltersDiv = document.getElementById('individual-report-filters');
    console.log("[renderReportSection] individualFiltersDiv element:", individualFiltersDiv);
    const roleComparisonFiltersDiv = document.getElementById('role-comparison-filters');
    console.log("[renderReportSection] roleComparisonFiltersDiv element:", roleComparisonFiltersDiv);
    const competencyReportFiltersDiv = document.getElementById('competency-report-filters'); 
    console.log("[renderReportSection] competencyReportFiltersDiv element:", competencyReportFiltersDiv);
    const reportDisplayArea = document.getElementById('report-display-area');
    console.log("[renderReportSection] reportDisplayArea element:", reportDisplayArea);
    
    const competencyReportDeptSelect = document.getElementById('competency-report-department-select');
    console.log("[renderReportSection] competencyReportDeptSelect element:", competencyReportDeptSelect);
    const competencyReportRoleSelect = document.getElementById('competency-report-role-select');
    console.log("[renderReportSection] competencyReportRoleSelect element:", competencyReportRoleSelect);

    // Populate new competency report filter dropdowns
    if (competencyReportDeptSelect) {
        configurableDepartments.forEach(dept => {
            competencyReportDeptSelect.innerHTML += `<option value="${dept.name}">${dept.name}</option>`;
        });
    } else { console.warn("[renderReportSection] competencyReportDeptSelect is null, cannot populate."); }
    if (competencyReportRoleSelect) {
        currentKpiData.forEach(role => { 
            competencyReportRoleSelect.innerHTML += `<option value="${role.roleName}">${role.roleName}</option>`;
        });
    } else { console.warn("[renderReportSection] competencyReportRoleSelect is null, cannot populate."); }

    // Ensure update functions are defined before use
    const reportStartPeriodInput = document.getElementById('report-start-period');
    const reportEndPeriodInput = document.getElementById('report-end-period');
    const reportRoleSelect = document.getElementById('report-role-select');
    const reportEmployeeSelect = document.getElementById('report-employee-select');
    const comparisonRoleSelect = document.getElementById('role-comparison-role-select');
    const roleComparisonPeriodSelect = document.getElementById('role-comparison-period-select');

    const updateIndividualReport = () => {
        if (!reportDisplayArea) { console.error("updateIndividualReport: reportDisplayArea not found"); return; }
        if (reportEmployeeSelect && reportRoleSelect && reportEmployeeSelect.value && reportRoleSelect.value) {
            displayEmployeePerformanceRecords(reportRoleSelect.value, reportEmployeeSelect.value);
        } else if (reportRoleSelect && reportRoleSelect.value && reportEmployeeSelect && !reportEmployeeSelect.value){
            reportDisplayArea.innerHTML = '<p>Please select an employee for the Individual Report.</p>';
        } else if (reportRoleSelect && !reportRoleSelect.value) {
            reportDisplayArea.innerHTML = '<p>Please select a role for the Individual Report.</p>';
        } else {
            reportDisplayArea.innerHTML = '<p>Select filters for the Individual Report.</p>';
        }
    };
    const updateRoleComparisonReport = () => { 
        if (!reportDisplayArea) { console.error("updateRoleComparisonReport: reportDisplayArea not found"); return; }
        if (comparisonRoleSelect && comparisonRoleSelect.value) {
            displayRolePerformanceComparison(comparisonRoleSelect.value);
        } else {
            reportDisplayArea.innerHTML = '<p>Please select a role for the Role Performance Comparison.</p>';
        }
    };

    function handleReportTypeChange(selectedTypeValue) {
        console.log("[handleReportTypeChange] Selected Type Value:", selectedTypeValue);
        
        if (generalReportFiltersDiv) generalReportFiltersDiv.style.display = 'none';
        if (individualFiltersDiv) individualFiltersDiv.style.display = 'none';
        if (roleComparisonFiltersDiv) roleComparisonFiltersDiv.style.display = 'none';
        if (competencyReportFiltersDiv) competencyReportFiltersDiv.style.display = 'none';
        if (reportDisplayArea) reportDisplayArea.innerHTML = '';

        if (selectedTypeValue === 'individual') {
            console.log("[handleReportTypeChange] Branch: Individual Report");
            if (generalReportFiltersDiv) generalReportFiltersDiv.style.display = 'block';
            if (individualFiltersDiv) individualFiltersDiv.style.display = 'block';
            if (typeof populateReportRoleFilter === "function") populateReportRoleFilter(); else console.error("populateReportRoleFilter is not defined");
            
            if (reportRoleSelect && reportEmployeeSelect && (!reportRoleSelect.value || !reportEmployeeSelect.value)) {
                reportEmployeeSelect.innerHTML = '<option value="">-- Select Employee --</option>';
                reportEmployeeSelect.disabled = true;
                if(reportDisplayArea) reportDisplayArea.innerHTML = '<p>Please select a role and employee for the Individual Report.</p>';
            } else { updateIndividualReport(); }

        } else if (selectedTypeValue === 'roleComparison') {
            console.log("[handleReportTypeChange] Branch: Role Comparison Report");
            if (roleComparisonFiltersDiv) roleComparisonFiltersDiv.style.display = 'block';
            if (typeof populateRoleComparisonRoleFilter === "function") populateRoleComparisonRoleFilter(); else console.error("populateRoleComparisonRoleFilter is not defined");
            
            if (comparisonRoleSelect && !comparisonRoleSelect.value) {
                 if(reportDisplayArea) reportDisplayArea.innerHTML = '<p>Please select a role for the Role Performance Comparison.</p>';
            } else { updateRoleComparisonReport(); }

        } else if (selectedTypeValue === 'competencyReport') {
            console.log("[handleReportTypeChange] Branch: Competency Report");
            if (competencyReportFiltersDiv) {
                competencyReportFiltersDiv.style.display = 'block';
                console.log("[handleReportTypeChange] Competency report filters display set to block.");
            } else {
                console.error("[handleReportTypeChange] competency-report-filters div NOT FOUND!");
            }
            if (typeof displayEmployeeCompetencyReport === "function") displayEmployeeCompetencyReport(); else console.error("displayEmployeeCompetencyReport is not defined");
        
        } else {
             console.log("[handleReportTypeChange] Branch: No specific report type selected or unknown type.");
             if(reportDisplayArea) reportDisplayArea.innerHTML = '<p>Please select a report type to view filters and records.</p>';
        }
    }

    if (reportTypeSelect) {
        reportTypeSelect.addEventListener('change', (event) => handleReportTypeChange(event.target.value));
        console.log("[renderReportSection] Event listener ATTACHED to reportTypeSelect.");
    } else {
        console.error("[renderReportSection] report-type-select element NOT FOUND! Cannot attach listener.");
    }
    
    if (competencyReportDeptSelect) {
        competencyReportDeptSelect.addEventListener('change', displayEmployeeCompetencyReport);
        console.log("[renderReportSection] Event listener ATTACHED to competencyReportDeptSelect.");
    } else { console.warn("[renderReportSection] competencyReportDeptSelect not found, listener not attached."); }
    if (competencyReportRoleSelect) {
        competencyReportRoleSelect.addEventListener('change', displayEmployeeCompetencyReport);
        console.log("[renderReportSection] Event listener ATTACHED to competencyReportRoleSelect.");
    } else { console.warn("[renderReportSection] competencyReportRoleSelect not found, listener not attached.");}

    // Attach other listeners, checking element existence
    if(reportStartPeriodInput) reportStartPeriodInput.addEventListener('change', updateIndividualReport); else console.warn("reportStartPeriodInput not found");
    if(reportEndPeriodInput) reportEndPeriodInput.addEventListener('change', updateIndividualReport); else console.warn("reportEndPeriodInput not found");
    if(reportRoleSelect) { 
        reportRoleSelect.addEventListener('change', () => {
            if (typeof populateReportEmployeeFilter === "function") populateReportEmployeeFilter(reportRoleSelect.value); else console.error("populateReportEmployeeFilter not defined");
            if (reportTypeSelect && reportTypeSelect.value === 'individual' && reportDisplayArea) {
                 reportDisplayArea.innerHTML = '<p>Please select an employee to view records.</p>'; 
            }
        });
    } else { console.warn("reportRoleSelect not found");}
    if(reportEmployeeSelect) { reportEmployeeSelect.addEventListener('change', updateIndividualReport); } else console.warn("reportEmployeeSelect not found");
    if (comparisonRoleSelect) { comparisonRoleSelect.addEventListener('change', updateRoleComparisonReport); } else console.warn("comparisonRoleSelect not found");
    if (roleComparisonPeriodSelect) { roleComparisonPeriodSelect.addEventListener('change', updateRoleComparisonReport); } else console.warn("roleComparisonPeriodSelect not found");

    // Initial call
    if (reportTypeSelect) {
        console.log("[renderReportSection] Making initial call to handleReportTypeChange with value:", reportTypeSelect.value);
        handleReportTypeChange(reportTypeSelect.value); 
    } else {
        console.error("[renderReportSection] Cannot make initial call to handleReportTypeChange, reportTypeSelect is null for initial call.");
        if(reportDisplayArea) reportDisplayArea.innerHTML = '<p>Error: Report type selector not found.</p>';
    }
}

function populateReportRoleFilter() {
    const roleSelect = document.getElementById('report-role-select');
    if (!roleSelect) return;

    roleSelect.innerHTML = '<option value="">-- Select Role --</option>'; // Reset
    
    // Get unique role names from employees who have performance records, or all configured roles
    // For simplicity now, let's use all configured roles from currentKpiData
    const rolesWithRecords = [...new Set(performanceRecords.map(record => record.roleName))];
    const allConfiguredRoles = currentKpiData.map(role => role.roleName);
    const uniqueRoleNames = [...new Set([...rolesWithRecords, ...allConfiguredRoles])].sort();

    if (uniqueRoleNames.length === 0) {
        roleSelect.innerHTML = '<option value="">-- No Roles Available --</option>';
        return;
    }

    uniqueRoleNames.forEach(roleName => {
        if (roleName) { // Ensure roleName is not undefined or empty
            roleSelect.innerHTML += `<option value="${roleName}">${roleName}</option>`;
        }
    });
}

function populateReportEmployeeFilter(selectedRoleName) {
    const employeeSelect = document.getElementById('report-employee-select');
    if (!employeeSelect) return;

    employeeSelect.innerHTML = '<option value="">-- Select Employee --</option>'; // Reset
    employeeSelect.disabled = true;

    if (!selectedRoleName) return;

    // Find employees who are assigned the selected role AND have performance records for that role.
    const employeesInRoleWithRecords = performanceRecords
        .filter(record => record.roleName === selectedRoleName)
        .map(record => ({ id: record.employeeId, name: record.employeeName })); // Get id and name

    const uniqueEmployees = [];
    const map = new Map();
    for (const emp of employeesInRoleWithRecords) {
        if(!map.has(emp.id)){
            map.set(emp.id, true);    // set any value to Map
            uniqueEmployees.push({
                id: emp.id,
                name: emp.name
            });
        }
    }
    // Sort unique employees by name for consistent dropdown order
    uniqueEmployees.sort((a, b) => a.name.localeCompare(b.name));

    if (uniqueEmployees.length > 0) {
        uniqueEmployees.forEach(emp => {
            employeeSelect.innerHTML += `<option value="${emp.id}">${emp.name} (ID: ${emp.id})</option>`;
        });
        employeeSelect.disabled = false;
    } else {
        employeeSelect.innerHTML = '<option value="">-- No Employees with Records for this Role --</option>';
        employeeSelect.disabled = true; // Keep it disabled if no relevant employees
    }
}

function displayEmployeePerformanceRecords(roleName, employeeId) {
    const displayArea = document.getElementById('report-display-area');
    if (!displayArea) return;

    const startPeriod = document.getElementById('report-start-period').value;
    const endPeriod = document.getElementById('report-end-period').value;
    const employeeObject = employeeData.find(emp => emp.id === employeeId);
    const employeeDisplayName = employeeObject ? employeeObject.name : employeeId;

    console.log(`[displayEmployeePerformanceRecords] Filtering for Role: ${roleName}, Emp: ${employeeDisplayName} (${employeeId}), Start: ${startPeriod}, End: ${endPeriod}`);

    let filteredRecords = performanceRecords.filter(
        record => record.roleName === roleName && record.employeeId === employeeId
    );
    if (startPeriod) { filteredRecords = filteredRecords.filter(record => record.period >= startPeriod); }
    if (endPeriod) { filteredRecords = filteredRecords.filter(record => record.period <= endPeriod); }

    if (filteredRecords.length === 0) {
        displayArea.innerHTML = '<p>No performance records found for this selection and period range.</p>';
        return;
    }
    filteredRecords.sort((a, b) => b.period.localeCompare(a.period));

    let reportHTML = `<h4>Performance History for ${employeeDisplayName} (${roleName}) [${startPeriod || 'Any'} - ${endPeriod || 'Any'}]:</h4>`;
    // ... (existing HTML generation for records list) ...
    filteredRecords.forEach((record, index) => {
        const recordDate = new Date(record.submissionTimestamp);
        const formattedTimestamp = recordDate.toLocaleString();
        const detailsDivId = `record-details-${record.submissionTimestamp.replace(/[:.]/g, '-')}-${index}`;
        reportHTML += `
            <div class="performance-record-item" style="margin-bottom: 15px; padding: 10px; background-color: #fff; border: 1px solid #ddd; border-radius: 4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                    <strong>Period: ${record.period}</strong>
                    <span style="font-size:0.9em; color:#555;">Submitted: ${formattedTimestamp}</span>
                </div>
                <p style="margin: 5px 0;"><strong>Total Score:</strong> ${record.totalScore}</p>
                <p style="margin: 5px 0;"><strong>Final Grade:</strong> ${record.finalGrade}</p>
                <button class="view-record-details-button" data-record-original-idx="${performanceRecords.indexOf(record)}" data-details-target-id="${detailsDivId}" style="padding: 5px 10px; font-size:0.9em;">View Details</button>
                <div class="record-kpi-details" id="${detailsDivId}" style="display:none; margin-top:10px; padding-left:15px; border-left: 2px solid #eee;"></div>
            </div>
        `;
    });
    
    // Add Download/Print buttons
    reportHTML += `
        <div id="report-actions" style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #ccc;">
            <button id="download-csv-individual" class="report-action-button">Download CSV</button>
            <button id="download-excel-individual" class="report-action-button" style="margin-left: 10px;">Download Excel (as CSV)</button>
            <button id="print-report-individual" class="report-action-button" style="margin-left: 10px;">Print Report</button>
        </div>
    `;

    displayArea.innerHTML = reportHTML;

    // Re-attach event listeners for view details buttons (same as before)
    document.querySelectorAll('.view-record-details-button').forEach(button => {
        button.addEventListener('click', (event) => {
            // ... (existing view details logic) ...
            const btn = event.target;
            const originalRecordIndex = parseInt(btn.dataset.recordOriginalIdx);
            const specificRecord = performanceRecords[originalRecordIndex];
            const targetDivId = btn.dataset.detailsTargetId;
            const detailsDiv = document.getElementById(targetDivId);
            if (detailsDiv && specificRecord && specificRecord.kpiDetails) {
                if (detailsDiv.style.display === 'none') {
                    let kpiDetailsHTML = '<h5>KPI Breakdown:</h5><ul style="list-style:none; padding-left:0;">';
                    specificRecord.kpiDetails.forEach(kpi => {
                        kpiDetailsHTML += `<li style="margin-bottom:3px;">
                            <strong>${kpi.name}:</strong> 
                            Actual: ${kpi.actualResult === 'N/A' || typeof kpi.actualResult === 'undefined' ? 'N/A' : (typeof kpi.actualResult === 'number' ? kpi.actualResult.toFixed(2) : kpi.actualResult)}, 
                            Sub-Grade: ${kpi.subGrade}, 
                            Score: ${kpi.subtotalScore === 'N/A' || typeof kpi.subtotalScore === 'undefined' ? 'N/A' : (typeof kpi.subtotalScore === 'number' ? kpi.subtotalScore.toFixed(2) : kpi.subtotalScore)} (Weightage: ${kpi.weightage}%)
                        </li>`;
                    });
                    kpiDetailsHTML += '</ul>';
                    detailsDiv.innerHTML = kpiDetailsHTML;
                    detailsDiv.style.display = 'block';
                    btn.textContent = 'Hide Details';
                } else {
                    detailsDiv.innerHTML = ''; 
                    detailsDiv.style.display = 'none';
                    btn.textContent = 'View Details';
                }
            }
        });
    });

    // Add event listeners for new action buttons
    const downloadCSVButton = document.getElementById('download-csv-individual');
    if (downloadCSVButton) {
        downloadCSVButton.addEventListener('click', () => {
            const filename = `Individual_Report_${employeeDisplayName.replace(/\s+/g, '_')}_${roleName.replace(/\s+/g, '_')}_${startPeriod || 'all'}_to_${endPeriod || 'all'}.csv`;
            const csvData = generateIndividualReportCSV(filteredRecords, employeeDisplayName, roleName);
            if (csvData) {
                triggerCSVDownload(csvData, filename);
            } else {
                alert('No data available to download for the current selection.');
            }
        });
    }

    const downloadExcelButton = document.getElementById('download-excel-individual');
    if (downloadExcelButton) {
        downloadExcelButton.addEventListener('click', () => {
            // Uses the same CSV generation logic
            const filename = `Individual_Report_${employeeDisplayName.replace(/\s+/g, '_')}_${roleName.replace(/\s+/g, '_')}_${startPeriod || 'all'}_to_${endPeriod || 'all'}.csv`;
            const csvData = generateIndividualReportCSV(filteredRecords, employeeDisplayName, roleName);
            if (csvData) {
                triggerCSVDownload(csvData, filename);
            } else {
                alert('No data available to download for the current selection.');
            }
        });
    }

    const printReportButton = document.getElementById('print-report-individual');
    if (printReportButton) {
        printReportButton.addEventListener('click', () => {
            // Simple window.print(). Consider adding print-specific CSS later if needed.
            window.print();
        });
    }
}

// New function for populating role filter for comparison report
function populateRoleComparisonRoleFilter() {
    const roleSelect = document.getElementById('role-comparison-role-select');
    if (!roleSelect) return;
    console.log("[populateRoleComparisonRoleFilter] Called");
    roleSelect.innerHTML = '<option value="">-- Select Role --</option>';
    
    // Populate with roles that have at least one performance record for more meaningful comparison
    const rolesWithPerformanceRecords = [...new Set(performanceRecords.map(record => record.roleName))].sort();

    if (rolesWithPerformanceRecords.length === 0) {
        roleSelect.innerHTML = '<option value="">-- No Roles with Performance Data --</option>';
        return;
    }
    rolesWithPerformanceRecords.forEach(roleName => {
        if (roleName) {
            roleSelect.innerHTML += `<option value="${roleName}">${roleName}</option>`;
        }
    });
}

// New function for displaying the comparison report
// MANUALLY REPLACE your existing displayRolePerformanceComparison function with this one:

// --- Initialization ---
// ... existing code ...

// Function to render Role Setup form (Add, Edit KPIs within a role, Delete KPIs, Add/Delete Roles)
function renderRoleSetupForm(container, selectedRoleFilterIndex = null) { // Added selectedRoleFilterIndex
    console.log(`[renderRoleSetupForm] Called. Container: ${container}, SelectedRoleFilterIndex: ${selectedRoleFilterIndex}`);
    if (!container) {
        console.error("[renderRoleSetupForm] Error: Container not found!");
        return;
    }

    let formHTML = `<h3>Role & KPI Setup</h3>`;

    // --- Add Role Filter Dropdown ---
    formHTML += `
        <div style="margin-bottom: 20px; padding: 10px; background-color: #e9e9e9; border-radius: 5px;">
            <label for="role-setup-filter-select" style="margin-right: 10px; font-weight: bold;">Filter by Role:</label>
            <select id="role-setup-filter-select" style="padding: 5px; min-width: 250px;">
                <option value="all">-- Show All Roles --</option>
    `;
    currentKpiData.forEach((role, index) => {
        // Check if this role index matches the selected filter index for the 'selected' attribute
        const isSelected = selectedRoleFilterIndex !== null && parseInt(selectedRoleFilterIndex) === index;
        formHTML += `<option value="${index}" ${isSelected ? 'selected' : ''}>${role.roleName}</option>`;
    });
    formHTML += `
            </select>
        </div>
    `;

    formHTML += `<div style="margin-bottom: 10px;">
                    <button id="add-new-role-button" class="setting-button">Add New Role</button>
                 </div>`;
    formHTML += `<div id="add-role-form-container" style="margin-bottom: 20px; margin-top:10px; padding:15px; border:1px solid #b0b0b0; background-color:#efefef; display:none;"></div>`;

    // Determine which roles to iterate over based on the filter
    let rolesToDisplay = currentKpiData;
    if (selectedRoleFilterIndex !== null && selectedRoleFilterIndex !== 'all') {
        const filterIndex = parseInt(selectedRoleFilterIndex);
        if (filterIndex >= 0 && filterIndex < currentKpiData.length) {
            rolesToDisplay = [currentKpiData[filterIndex]];
        } else {
            console.warn(`[renderRoleSetupForm] Invalid filter index ${selectedRoleFilterIndex}, showing all roles.`);
            // Fallback to showing all if index is bad, though dropdown should prevent this.
        }
    }
    
    // If rolesToDisplay is a filtered list (single role), we need to get its original index for data-attributes
    rolesToDisplay.forEach((role, displayLoopIndex) => {
        // IMPORTANT: Get the original index of the role in currentKpiData
        // This is crucial for data attributes if rolesToDisplay is filtered.
        const originalRoleIndex = (selectedRoleFilterIndex !== null && selectedRoleFilterIndex !== 'all') 
                               ? parseInt(selectedRoleFilterIndex) 
                               : currentKpiData.findIndex(r => r.roleName === role.roleName); // Fallback, less efficient but covers 'all' correctly if needed
                                                                                             // More robust: if 'all', displayLoopIndex maps directly if currentKpiData is the source.
                                                                                             // Or, if filtering, originalRoleIndex is just selectedRoleFilterIndex.

        // Simpler: If we are filtering to a single role, its original index is selectedRoleFilterIndex.
        // If showing all, the loop index (displayLoopIndex) is the originalRoleIndex relative to currentKpiData.
        const roleIdxForData = (selectedRoleFilterIndex !== null && selectedRoleFilterIndex !== 'all')
                             ? parseInt(selectedRoleFilterIndex)
                             : displayLoopIndex;


        formHTML += `
            <div class="role-setup-block" style="margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-radius: 5px; background-color: #f9f9f9;">
                <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom:10px;">
                    <h4 id="role-name-display-${roleIdxForData}" class="editable-role-name" data-role-idx="${roleIdxForData}" title="Click to edit role name" style="cursor:pointer;">${role.roleName}</h4>
                    <input type="text" id="role-name-input-${roleIdxForData}" value="${role.roleName}" data-role-idx="${roleIdxForData}" class="role-name-input-field" style="display:none; flex-grow:1; margin-right:10px;">
                    <div>
                        <button class="edit-role-name-button setting-button-small" data-role-idx="${roleIdxForData}" style="margin-right: 5px;">Edit Name</button>
                        <button class="delete-role-button setting-button-small danger" data-role-idx="${roleIdxForData}">Delete Role</button>
                    </div>
                </div>
                <div id="kpi-list-for-role-${roleIdxForData}" style="margin-left:15px;">`;

        role.kpis.forEach((kpi, kpiIndex) => {
            formHTML += `
                <div class="kpi-item-setup" style="padding:10px; margin-bottom:8px; border:1px solid #e0e0e0; background-color:white; border-radius:4px;">
                    <p style="margin:0 0 5px 0;"><strong>KPI:</strong> ${kpi.name} (Weightage: ${kpi.weightage}%) <span style="font-size:0.85em; color:#555;">(Type: ${kpi.inputType})</span></p>
                    <button class="edit-kpi-button setting-button-small" data-role-idx="${roleIdxForData}" data-kpi-idx="${kpiIndex}">Edit KPI</button>
                    <button class="delete-kpi-button setting-button-small danger" data-role-idx="${roleIdxForData}" data-kpi-idx="${kpiIndex}" style="margin-left:5px;">Delete KPI</button>
                </div>`;
        });
        formHTML += `</div> <!-- kpi-list-for-role-${roleIdxForData} -->`;
        formHTML += `<button class="add-kpi-to-role-button setting-button-small" data-role-idx="${roleIdxForData}" style="margin-top:10px;">Add KPI to ${role.roleName}</button>`;
        formHTML += `</div> <!-- role-setup-block -->`;
    });

    formHTML += `<div id="add-edit-kpi-form-container" style="margin-top:20px; padding:15px; border:1px solid #b0b0b0; background-color:#efefef; display:none;"></div>`;

    // Preserve content of add-role-form-container and add-edit-kpi-form-container if they exist and have content
    // This is tricky because we are overwriting container.innerHTML.
    // For now, changing the filter will clear these sub-forms as per simpler approach.
    container.innerHTML = formHTML;
    console.log("[renderRoleSetupForm] HTML generated and set.");

    attachRoleSetupEventListeners(); 
}

function attachRoleSetupEventListeners() {
    console.log("[attachRoleSetupEventListeners] Called.");
    const specificSettingsContainer = document.getElementById('specific-settings-container');
    const roleSetupFilterSelect = document.getElementById('role-setup-filter-select'); // For re-rendering logic

    // --- Event Delegation for dynamic buttons within specificSettingsContainer ---
    if (specificSettingsContainer) {
        // Define the single delegated listener function
        const delegatedRoleSetupListener = (event) => {
            const target = event.target;
            const currentFilterValue = roleSetupFilterSelect ? roleSetupFilterSelect.value : 'all';
            const roleSetupContainerForRefresh = specificSettingsContainer; // Alias for clarity

            // Handle 'Edit KPI' clicks
            if (target.matches('.edit-kpi-button')) {
                const roleIndex = parseInt(target.dataset.roleIdx);
                const kpiIndex = parseInt(target.dataset.kpiIdx);
                console.log(`[DELEGATED CLICK] 'Edit KPI' for roleIdx: ${roleIndex}, kpiIdx: ${kpiIndex}`);
                renderAddEditKpiForm(roleIndex, kpiIndex);
                return;
            }

            // Handle 'Delete KPI' clicks
            if (target.matches('.delete-kpi-button')) {
                const roleIndex = parseInt(target.dataset.roleIdx);
                const kpiIndex = parseInt(target.dataset.kpiIdx);
                if (isNaN(roleIndex) || roleIndex < 0 || roleIndex >= currentKpiData.length ||
                    isNaN(kpiIndex) || kpiIndex < 0 || kpiIndex >= currentKpiData[roleIndex].kpis.length) {
                    console.error("[DELEGATED CLICK] Invalid role or KPI index for delete. RoleIdx:", roleIndex, "KpiIdx:", kpiIndex);
                    alert("Error: Could not delete KPI due to an invalid index.");
                    return;
                }
                const roleName = currentKpiData[roleIndex].roleName;
                const kpiToDelete = currentKpiData[roleIndex].kpis[kpiIndex];
                const kpiName = kpiToDelete.name;
                if (window.confirm(`Are you sure you want to delete the KPI "${kpiName}" from the role "${roleName}"?`)) {
                    currentKpiData[roleIndex].kpis.splice(kpiIndex, 1);
                    persistKpiSettings();
                    alert(`KPI "${kpiName}" has been deleted from role "${roleName}".`);
                    renderRoleSetupForm(roleSetupContainerForRefresh, currentFilterValue === 'all' ? null : currentFilterValue);
                }
                return;
            }

            // Handle 'Add KPI to Role' clicks
            if (target.matches('.add-kpi-to-role-button')) {
                const roleIndex = parseInt(target.dataset.roleIdx);
                console.log(`[DELEGATED CLICK] 'Add KPI to Role' for roleIdx: ${roleIndex}`);
                renderAddEditKpiForm(roleIndex, null);
                return;
            }

            // Handle 'Edit Role Name' clicks
            if (target.matches('.edit-role-name-button')) {
                const roleIndex = parseInt(target.dataset.roleIdx);
                const roleNameDisplay = document.getElementById(`role-name-display-${roleIndex}`);
                const roleNameInput = document.getElementById(`role-name-input-${roleIndex}`);
                if (!roleNameDisplay || !roleNameInput) return;

                const isCurrentlyEditing = roleNameInput.style.display !== 'none';
                if (isCurrentlyEditing) {
                    const newRoleName = roleNameInput.value.trim();
                    const originalRoleName = currentKpiData[roleIndex].roleName;
                    if (!newRoleName) { alert("Role name cannot be empty."); roleNameInput.focus(); return; }
                    if (newRoleName.toLowerCase() !== originalRoleName.toLowerCase()) {
                        const isDuplicate = currentKpiData.some((role, idx) => idx !== roleIndex && role.roleName.toLowerCase() === newRoleName.toLowerCase());
                        if (isDuplicate) { alert(`A role with the name "${newRoleName}" already exists.`); roleNameInput.focus(); return; }
                    }
                    currentKpiData[roleIndex].roleName = newRoleName;
                    persistKpiSettings();
                    alert('Role name updated successfully!');
                    renderRoleSetupForm(roleSetupContainerForRefresh, currentFilterValue === 'all' ? null : currentFilterValue);
                } else {
                    roleNameDisplay.style.display = 'none';
                    roleNameInput.style.display = 'block';
                    roleNameInput.focus();
                    target.textContent = 'Save Name'; // 'target' is the button itself
                }
                return;
            }

            // Handle 'Delete Role' clicks
            if (target.matches('.delete-role-button')) {
                const roleIndex = parseInt(target.dataset.roleIdx);
                if (isNaN(roleIndex) || roleIndex < 0 || roleIndex >= currentKpiData.length) return;
                const roleToDelete = currentKpiData[roleIndex];
                if (window.confirm(`Are you sure you want to delete the role "${roleToDelete.roleName}"? This will also remove all KPIs defined under it.`)) {
                    currentKpiData.splice(roleIndex, 1);
                    persistKpiSettings();
                    alert(`Role "${roleToDelete.roleName}" and its associated KPIs have been deleted.`);
                    renderRoleSetupForm(roleSetupContainerForRefresh, null); // Show all after delete
                }
                return;
            }
        };

        // Remove old listener if it exists (by checking stored function) and add the new one
        if (specificSettingsContainer._delegatedRoleSetupListener) {
            specificSettingsContainer.removeEventListener('click', specificSettingsContainer._delegatedRoleSetupListener);
            // console.log('[attachRoleSetupEventListeners] Removed old DELEGATED listener from specificSettingsContainer.');
        }
        specificSettingsContainer.addEventListener('click', delegatedRoleSetupListener);
        specificSettingsContainer._delegatedRoleSetupListener = delegatedRoleSetupListener; // Store the listener
        console.log('[attachRoleSetupEventListeners] Attached new DELEGATED listener to specificSettingsContainer.');
    }

    // --- Listeners for elements that are part of this form but might be handled directly (or also delegated) ---

    // Role Setup Filter Dropdown
    if (roleSetupFilterSelect) {
        const filterChangeListener = (event) => {
            const selectedValue = event.target.value;
            console.log(`[attachRoleSetupEventListeners] Role Setup Filter changed to: ${selectedValue}`);
            const addRoleForm = document.getElementById('add-role-form-container');
            const addEditKpiForm = document.getElementById('add-edit-kpi-form-container');
            if(addRoleForm) { addRoleForm.innerHTML = ''; addRoleForm.style.display = 'none'; }
            if(addEditKpiForm) { addEditKpiForm.innerHTML = ''; addEditKpiForm.style.display = 'none'; }
            
            // When re-rendering, ensure the container knows its delegated listener might need to be re-evaluated if the container itself was replaced.
            // However, renderRoleSetupForm gets specificSettingsContainer, so the instance is the same.
            // The flag _delegatedRoleSetupListener being re-assigned above handles re-attaching to the same instance correctly.
            renderRoleSetupForm(specificSettingsContainer, selectedValue === 'all' ? null : selectedValue);
        };
        // Remove old listener and add new one to prevent duplicates on this specific element
        if (roleSetupFilterSelect._myChangeListener) {
            roleSetupFilterSelect.removeEventListener('change', roleSetupFilterSelect._myChangeListener);
        }
        roleSetupFilterSelect.addEventListener('change', filterChangeListener);
        roleSetupFilterSelect._myChangeListener = filterChangeListener;
    }

    // 'Add New Role' button
    const addNewRoleButton = document.getElementById('add-new-role-button');
    if (addNewRoleButton) {
        const addNewRoleHandler = () => {
            console.log("[attachRoleSetupEventListeners] 'Add New Role' button CLICKED (direct attachment).");
            const addRoleFormContainer = document.getElementById('add-role-form-container');
            if (addRoleFormContainer) renderAddRoleForm(addRoleFormContainer);
        };
        // Remove old listener and add new one
        if (addNewRoleButton._myClickListener) {
            addNewRoleButton.removeEventListener('click', addNewRoleButton._myClickListener);
        }
        addNewRoleButton.addEventListener('click', addNewRoleHandler);
        addNewRoleButton._myClickListener = addNewRoleHandler;
    }
}

// ... (rest of script.js) ...

// Ensure renderAddRoleForm and renderAddEditKpiForm are defined before attachRoleSetupEventListeners or its invocation pathway.
// It's safest to place their definitions earlier in the script if there's any doubt.

// ... (other functions like renderRoleSetupForm, etc. might be here) ...

function renderAddRoleForm(container) {
    console.log("[renderAddRoleForm] Called. Container:", container);
    if (!container) {
        console.error("[renderAddRoleForm] Error: Container for add role form not found!");
        return;
    }
    container.innerHTML = `
        <h4>Add New Role</h4>
        <div class="kpi-form-field">
            <label for="new-role-name-input">Role Name:</label>
            <input type="text" id="new-role-name-input" placeholder="Enter new role name" required>
        </div>
        <div style="margin-top: 15px;">
            <button id="save-new-role-button" class="setting-button">Save Role</button>
            <button type="button" id="cancel-add-role-button" class="setting-button-secondary">Cancel</button>
        </div>
    `;
    container.style.display = 'block';
    const saveNewRoleButton = document.getElementById('save-new-role-button');
    const cancelAddRoleButton = document.getElementById('cancel-add-role-button');
    const newRoleNameInput = document.getElementById('new-role-name-input');
    const specificSettingsContainer = document.getElementById('specific-settings-container');
    if (saveNewRoleButton && newRoleNameInput && specificSettingsContainer) {
        saveNewRoleButton.addEventListener('click', () => {
            const newRoleName = newRoleNameInput.value.trim();
            if (!newRoleName) { alert("Role name cannot be empty."); return; }
            const isDuplicate = currentKpiData.some(role => role.roleName.toLowerCase() === newRoleName.toLowerCase());
            if (isDuplicate) { alert(`A role with the name "${newRoleName}" already exists.`); return; }
            currentKpiData.push({ roleName: newRoleName, kpis: [] });
            persistKpiSettings();
            alert(`Role "${newRoleName}" added successfully!`);
            container.innerHTML = '';
            container.style.display = 'none';
            renderRoleSetupForm(specificSettingsContainer); // Re-render with null to show all roles
        });
    }
    if (cancelAddRoleButton) {
        cancelAddRoleButton.addEventListener('click', () => {
            container.innerHTML = '';
            container.style.display = 'none';
        });
    }
}

function renderAddEditKpiForm(roleIndex, kpiIndex = null) {
    const formContainer = document.getElementById('add-edit-kpi-form-container');
    if (!formContainer) { console.error("[renderAddEditKpiForm] KPI form container not found!"); return; }
    const isEditing = kpiIndex !== null;
    const role = currentKpiData[roleIndex];
    if (!role) { alert("Error: Role not found for KPI form."); return; }
    const kpi = isEditing ? role.kpis[kpiIndex] : null;
    console.log(`[renderAddEditKpiForm] Called for Role: "${role.roleName}". Editing KPI: ${isEditing ? `"${kpi ? kpi.name : 'N/A'}"` : 'No'}`);

    // Determine initial input type for default bands if adding new KPI
    const initialInputTypeForBands = kpi ? kpi.inputType : (configurableInputTypes.length > 0 ? configurableInputTypes[0].value : 'percentage'); // Default to 'percentage' for new KPIs initially

    // Default bands structure - will be adapted based on actual input type later if new KPI
    let currentBands = kpi ? kpi.performanceBands : [
        { gradeName: "Poor Performance", gradeValue: 1, condition: { type: initialInputTypeForBands, operator: "lte", value: 0 } },
        { gradeName: "Below Expectations", gradeValue: 2, condition: { type: initialInputTypeForBands, operator: "range_inclusive_inclusive", lower: 0, upper: 0 } },
        { gradeName: "Meets Expectations", gradeValue: 3, condition: { type: initialInputTypeForBands, operator: "range_inclusive_inclusive", lower: 0, upper: 0 } },
        { gradeName: "Exceeds Expectations", gradeValue: 4, condition: { type: initialInputTypeForBands, operator: "range_inclusive_inclusive", lower: 0, upper: 0 } },
        { gradeName: "Outstanding Performance", gradeValue: 5, condition: { type: initialInputTypeForBands, operator: "gte", value: 0 } }
    ];

    let formHTML = `
        <h4>${isEditing ? `Edit KPI for ${role.roleName}` : `Add New KPI to ${role.roleName}`}</h4>
        <input type="hidden" id="kpi-form-role-idx" value="${roleIndex}">
        <input type="hidden" id="kpi-form-kpi-idx" value="${kpiIndex !== null ? kpiIndex : ''}">
        <div class="kpi-form-field"><label for="kpi-name">KPI Name:</label><input type="text" id="kpi-name" value="${kpi ? kpi.name : ''}" required></div>
        <div class="kpi-form-field"><label for="kpi-weightage">Weightage (%):</label><input type="number" id="kpi-weightage" value="${kpi ? kpi.weightage : ''}" min="0" max="100" step="1" required></div>
        <div class="kpi-form-field">
            <label for="kpi-input-type">Input Type:</label>
            <select id="kpi-input-type" required>
                ${configurableInputTypes.map(type => 
                    `<option value="${type.value}" ${(kpi && kpi.inputType === type.value) || (!kpi && initialInputTypeForBands === type.value) ? 'selected' : ''}>${type.label}</option>`
                ).join('')}
            </select>
        </div>
        <div class="kpi-form-field">
            <label for="kpi-lower-is-better">Lower is Better?</label>
            <select id="kpi-lower-is-better">
                <option value="false" ${kpi && !kpi.lowerIsBetter ? 'selected' : ''}>No</option>
                <option value="true" ${kpi && kpi.lowerIsBetter ? 'selected' : ''}>Yes</option>
            </select>
        </div>
        <div class="kpi-form-field"><label for="kpi-remarks">Remarks:</label><textarea id="kpi-remarks" rows="3">${kpi ? kpi.remarks : ''}</textarea></div>
        
        <div id="kpi-performance-bands-container" style="margin-top:15px; padding-top:10px; border-top: 1px solid #ccc;">
            <h5>Performance Bands</h5>`;

    currentBands.forEach((band, bandIdx) => {
        const kpiInputTypeForBandValue = document.getElementById('kpi-input-type') ? document.getElementById('kpi-input-type').value : (kpi ? kpi.inputType : initialInputTypeForBands);
        const unit = getUnitForBandInput(kpiInputTypeForBandValue, band.condition.type);
        formHTML += `<div class="band-edit-item" style="margin-bottom: 8px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 3px; background-color: #fcfcfc;">
                        <strong style="font-size:0.9em;">${band.gradeName} (Grade ${band.gradeValue}):</strong>`;
        if (band.condition.operator === 'range_inclusive_inclusive') {
            formHTML += `
                <label for="kpi-band-${bandIdx}-lower" style="margin-left:10px; margin-right:3px;">Lower:</label>
                <input type="number" step="any" id="kpi-band-${bandIdx}-lower" class="kpi-band-input-lower" data-band-idx="${bandIdx}" value="${band.condition.lower !== undefined ? band.condition.lower : ''}" style="width: 60px; margin-right: 2px;">${unit}
                <label for="kpi-band-${bandIdx}-upper" style="margin-left:10px; margin-right:3px;">Upper:</label>
                <input type="number" step="any" id="kpi-band-${bandIdx}-upper" class="kpi-band-input-upper" data-band-idx="${bandIdx}" value="${band.condition.upper !== undefined ? band.condition.upper : ''}" style="width: 60px; margin-right: 2px;">${unit}
            `;
        } else {
            formHTML += `
                <label for="kpi-band-${bandIdx}-value" style="margin-left:10px; margin-right:3px;">Value:</label>
                <input type="number" step="any" id="kpi-band-${bandIdx}-value" class="kpi-band-input-value" data-band-idx="${bandIdx}" value="${band.condition.value !== undefined ? band.condition.value : ''}" style="width: 60px; margin-right: 2px;">${unit}
            `;
        }
        formHTML += `</div>`;
    });

    formHTML += `</div>
        <div style="margin-top: 20px;"><button id="save-kpi-button" class="setting-button">${isEditing ? 'Save Changes to KPI' : 'Save New KPI'}</button><button type="button" id="cancel-kpi-form-button" class="setting-button-secondary">Cancel</button></div>
    `;
    formContainer.innerHTML = formHTML;
    formContainer.style.display = 'block';

    const kpiInputTypeSelect = document.getElementById('kpi-input-type');
    if (kpiInputTypeSelect) {
        kpiInputTypeSelect.addEventListener('change', () => {
            const selectedKpiType = kpiInputTypeSelect.value;
            let bandInputsHTML = '<h5>Performance Bands</h5>';
            currentBands.forEach((band, bandIdx) => { 
                const unit = getUnitForBandInput(selectedKpiType, band.condition.type); 
                bandInputsHTML += `<div class="band-edit-item" style="margin-bottom: 8px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 3px; background-color: #fcfcfc;">
                                    <strong style="font-size:0.9em;">${band.gradeName} (Grade ${band.gradeValue}):</strong>`;
                if (band.condition.operator === 'range_inclusive_inclusive') {
                    const lowerVal = document.getElementById(`kpi-band-${bandIdx}-lower`) ? document.getElementById(`kpi-band-${bandIdx}-lower`).value : (band.condition.lower !== undefined ? band.condition.lower : '');
                    const upperVal = document.getElementById(`kpi-band-${bandIdx}-upper`) ? document.getElementById(`kpi-band-${bandIdx}-upper`).value : (band.condition.upper !== undefined ? band.condition.upper : '');
                    bandInputsHTML += `
                        <label for="kpi-band-${bandIdx}-lower" style="margin-left:10px; margin-right:3px;">Lower:</label>
                        <input type="number" step="any" id="kpi-band-${bandIdx}-lower" class="kpi-band-input-lower" data-band-idx="${bandIdx}" value="${lowerVal}" style="width: 60px; margin-right: 2px;">${unit}
                        <label for="kpi-band-${bandIdx}-upper" style="margin-left:10px; margin-right:3px;">Upper:</label>
                        <input type="number" step="any" id="kpi-band-${bandIdx}-upper" class="kpi-band-input-upper" data-band-idx="${bandIdx}" value="${upperVal}" style="width: 60px; margin-right: 2px;">${unit}`;
                } else {
                    const val = document.getElementById(`kpi-band-${bandIdx}-value`) ? document.getElementById(`kpi-band-${bandIdx}-value`).value : (band.condition.value !== undefined ? band.condition.value : '');
                    bandInputsHTML += `
                        <label for="kpi-band-${bandIdx}-value" style="margin-left:10px; margin-right:3px;">Value:</label>
                        <input type="number" step="any" id="kpi-band-${bandIdx}-value" class="kpi-band-input-value" data-band-idx="${bandIdx}" value="${val}" style="width: 60px; margin-right: 2px;">${unit}`;
                }
                bandInputsHTML += `</div>`;
            });
            document.getElementById('kpi-performance-bands-container').innerHTML = bandInputsHTML;
        });
    }

    document.getElementById('save-kpi-button').addEventListener('click', () => {
        const currentRoleIndex = parseInt(document.getElementById('kpi-form-role-idx').value);
        const currentKpiIndexVal = document.getElementById('kpi-form-kpi-idx').value;
        const isCurrentlyEditing = currentKpiIndexVal !== '';
        const kpiToEditIndex = isCurrentlyEditing ? parseInt(currentKpiIndexVal) : null;
        const kpiName = document.getElementById('kpi-name').value.trim();
        const kpiWeightage = parseFloat(document.getElementById('kpi-weightage').value);
        const kpiInputType = document.getElementById('kpi-input-type').value;
        const kpiLowerIsBetter = document.getElementById('kpi-lower-is-better').value === 'true';
        const kpiRemarks = document.getElementById('kpi-remarks').value.trim();
        if (!kpiName) { alert("KPI Name cannot be empty."); return; }
        if (isNaN(kpiWeightage) || kpiWeightage < 0 || kpiWeightage > 100) { alert("Weightage must be a number between 0 and 100."); return; }
        const updatedPerformanceBands = JSON.parse(JSON.stringify(currentBands));
        updatedPerformanceBands.forEach((band, bandIdx) => {
            band.condition.type = kpiInputType; 
            if (band.condition.operator === 'range_inclusive_inclusive') {
                const lowerInput = document.getElementById(`kpi-band-${bandIdx}-lower`);
                const upperInput = document.getElementById(`kpi-band-${bandIdx}-upper`);
                band.condition.lower = lowerInput && lowerInput.value !== '' ? parseFloat(lowerInput.value) : 0; 
                band.condition.upper = upperInput && upperInput.value !== '' ? parseFloat(upperInput.value) : 0; 
                if (isNaN(band.condition.lower) || isNaN(band.condition.upper)) {
                    alert(`Invalid number for band '${band.gradeName}'. Please check inputs.`); throw new Error("Invalid band input"); 
                }
            } else { 
                const valueInput = document.getElementById(`kpi-band-${bandIdx}-value`);
                band.condition.value = valueInput && valueInput.value !== '' ? parseFloat(valueInput.value) : 0; 
                if (isNaN(band.condition.value)) {
                     alert(`Invalid number for band '${band.gradeName}'. Please check inputs.`); throw new Error("Invalid band input");
                }
            }
        });
        const kpiData = { 
            name: kpiName, remarks: kpiRemarks, weightage: kpiWeightage, maxRating: 5, 
            inputType: kpiInputType, lowerIsBetter: kpiLowerIsBetter, performanceBands: updatedPerformanceBands
        };
        if (isCurrentlyEditing) {
            currentKpiData[currentRoleIndex].kpis[kpiToEditIndex] = kpiData;
            alert('KPI updated successfully!');
        } else {
            currentKpiData[currentRoleIndex].kpis.push(kpiData);
            alert('New KPI added successfully!');
        }
        persistKpiSettings();
        formContainer.innerHTML = '';
        formContainer.style.display = 'none';
        const roleSetupFilterSelect = document.getElementById('role-setup-filter-select');
        const currentFilterValue = roleSetupFilterSelect ? roleSetupFilterSelect.value : 'all';
        renderRoleSetupForm(document.getElementById('specific-settings-container'), currentFilterValue === 'all' ? null : currentFilterValue);
    });
    document.getElementById('cancel-kpi-form-button').addEventListener('click', () => {
        formContainer.innerHTML = '';
        formContainer.style.display = 'none';
    });
}

// ... rest of script.js ...

// attachRoleSetupEventListeners should be defined after the functions it calls, or ensure it's called after DOMContentLoaded
// ... (attachRoleSetupEventListeners and other remaining functions)

// --- Input Type Management ---
    // Around line 2278
    async function loadInputTypes() {
        configurableInputTypes = []; // Clear local array before loading
        try {
            const querySnapshot = await getDocs(collection(db, "inputTypes"));
            querySnapshot.forEach((docSnap) => {
                configurableInputTypes.push({ id: docSnap.id, ...docSnap.data() });
            });
            console.log('Configurable input types loaded from Firestore:', configurableInputTypes);
        } catch (error) {
            console.error('Error loading configurable input types from Firestore:', error);
            configurableInputTypes = []; // Reset to empty on error or provide default types
            // Optionally, define default types if Firestore is empty/errors out:
            // configurableInputTypes = [
            //     { id: "default_percentage", value: "percentage", label: "Percentage (%)", unitSymbol: "%" },
            //     { id: "default_number", value: "number", label: "Number", unitSymbol: "" },
            //     // Add other essential defaults if necessary
            // ];
            // console.warn('Initialized with default input types due to loading error or empty collection.');
        }
    }


async function renderInputTypeSetupForm(container, editModeData = null) {
    console.log("[renderInputTypeSetupForm] Called. Edit Mode Data:", editModeData);
    if (!container) { /* ... error handling ... */ return; }

    const isEditing = editModeData !== null;
    const originalValueForEdit = isEditing ? editModeData.value : '';
    const currentUnitSymbol = isEditing ? (editModeData.unitSymbol || '') : '';

    let formHTML = `<h3>Manage Input Types</h3>
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; background-color: #f8f8f8; border-radius: 4px;">
            <h4>${isEditing ? 'Edit Input Type' : 'Add New Input Type'}</h4>
            ${isEditing ? `<input type="hidden" id="original-input-type-value-for-edit" value="${originalValueForEdit}">` : ''}
            <div class="kpi-form-field">
                <label for="input-type-value">Value (unique, e.g., 'currency_usd'):</label>
                <input type="text" id="input-type-value" placeholder="e.g., currency_usd" value="${isEditing ? editModeData.value : ''}">
            </div>
            <div class="kpi-form-field">
                <label for="input-type-label">Display Label (e.g., 'Currency (USD)'):</label>
                <input type="text" id="input-type-label" placeholder="e.g., Currency (USD)" value="${isEditing ? editModeData.label : ''}">
            </div>
            <div class="kpi-form-field"> <!-- Added Unit Symbol Field -->
                <label for="input-type-unit-symbol">Unit Symbol (Optional, e.g., '%', '$', 'items'):</label>
                <input type="text" id="input-type-unit-symbol" placeholder="e.g., $" value="${currentUnitSymbol}">
            </div>
            <button id="save-input-type-button" class="setting-button" style="margin-top:10px;">${isEditing ? 'Save Changes' : 'Add Input Type'}</button>
            ${isEditing ? '<button id="cancel-edit-input-type-button" type="button" class="setting-button-secondary" style="margin-left:10px;">Cancel Edit</button>' : ''}
        </div>
        <h4>Existing Input Types</h4>
        <ul id="existing-input-types-list" style="list-style: none; padding: 0;">`;

    if (configurableInputTypes.length === 0 && !isEditing) {
        formHTML += '<p>No configurable input types found. Add one above.</p>';
    }

    configurableInputTypes.forEach((inputType) => {
        if (!(isEditing && inputType.value === originalValueForEdit)) {
            formHTML += `<li style="margin-bottom: 10px; padding: 10px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                            <span><strong>Label:</strong> ${inputType.label} (<strong>Value:</strong> ${inputType.value}) ${inputType.unitSymbol ? `[Unit: ${inputType.unitSymbol}]` : ''}</span>
                            <div>
                                <button class="edit-input-type-button setting-button-small" data-input-type-value="${inputType.value}" style="margin-right:5px;">Edit</button>
                                <button class="delete-input-type-button setting-button-small danger" data-input-type-value="${inputType.value}">Delete</button>
                            </div>
                        </li>`;
        }
    });
    formHTML += `</ul>`;
    container.innerHTML = formHTML;

    // Event Listeners
    const saveButton = document.getElementById('save-input-type-button');
    const valueInput = document.getElementById('input-type-value');
    const labelInput = document.getElementById('input-type-label');
    const unitSymbolInput = document.getElementById('input-type-unit-symbol'); // Get unit symbol input

    if (saveButton) {
        saveButton.addEventListener('click', async () => { // MODIFIED: Made async
            const newValue = valueInput.value.trim();
            const newLabel = labelInput.value.trim();
            const newUnitSymbol = unitSymbolInput.value.trim(); 

            if (!newValue || !newLabel) {
                alert('Both Value and Label are required.');
                return;
            }
            // Create the base object, ID will be added
            let inputTypeData = { value: newValue, label: newLabel, unitSymbol: newUnitSymbol };

            if (isEditing) {
                const originalVal = document.getElementById('original-input-type-value-for-edit').value;
                const itemIndex = configurableInputTypes.findIndex(it => it.value === originalVal);
                if (itemIndex === -1) { 
                    console.error("Error updating input type: Original item not found for editing.");
                    alert("Error: Could not find the original input type to update.");
                    renderInputTypeSetupForm(container); 
                    return; 
                }
                if (newValue.toLowerCase() !== originalVal.toLowerCase() && configurableInputTypes.some(it => it.value.toLowerCase() === newValue.toLowerCase())) {
                    alert(`An input type with the value "${newValue}" already exists. Value must be unique.`);
                    return;
                }
                
                // MODIFIED: Preserve existing ID
                inputTypeData.id = configurableInputTypes[itemIndex].id; 
                
                configurableInputTypes[itemIndex] = inputTypeData;
                await persistCollection('inputTypes', configurableInputTypes); // MODIFIED: Persist to Firestore
                alert('Input type updated successfully!');

            } else { // Adding new
                if (configurableInputTypes.some(it => it.value.toLowerCase() === newValue.toLowerCase())) {
                    alert(`An input type with the value "${newValue}" already exists. Value must be unique.`);
                    return;
                }
                
                // MODIFIED: Generate Firestore ID for new item
                const newId = doc(collection(db, "inputTypes")).id;
                inputTypeData.id = newId; 

                configurableInputTypes.push(inputTypeData);
                await persistCollection('inputTypes', configurableInputTypes); // MODIFIED: Persist to Firestore
                alert('Input type added successfully!');
            }
            // persistInputTypes(); // REMOVED: Old localStorage call
            renderInputTypeSetupForm(container); // Re-render the UI
        });
    }
    // ... (Cancel Edit, Edit button, Delete button listeners remain the same)
    if (isEditing) {
        const cancelButton = document.getElementById('cancel-edit-input-type-button');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                renderInputTypeSetupForm(container); // Re-render in add mode
            });
        }
    }
    document.querySelectorAll('.edit-input-type-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const valueToEdit = event.target.dataset.inputTypeValue;
            const typeToEdit = configurableInputTypes.find(it => it.value === valueToEdit);
            if (typeToEdit) {
                renderInputTypeSetupForm(container, typeToEdit); // Re-render in edit mode
            }
        });
    });
    document.querySelectorAll('.delete-input-type-button').forEach(button => {
        button.addEventListener('click', async (event) => {
            const valueToDelete = event.target.dataset.inputTypeValue;
            if (isEditing && valueToDelete === document.getElementById('original-input-type-value-for-edit').value) {
                alert("Cannot delete the input type you are currently editing. Cancel edit first.");
                return;
            }
            if (confirm(`Are you sure you want to delete the input type "${valueToDelete}"? This cannot be undone and might affect existing KPIs if they use this type.`)) {
                configurableInputTypes = configurableInputTypes.filter(it => it.value !== valueToDelete);
                await persistCollection('inputTypes', configurableInputTypes);
                renderInputTypeSetupForm(container); // Re-render the form
            }
        });
    });
}

function getUnitForBandInput(kpiInputType, bandConditionType) {
    // First, try to find a unit from configurableInputTypes
    const configuredType = configurableInputTypes.find(type => type.value === kpiInputType);
    if (configuredType && configuredType.unitSymbol) {
        return ` ${configuredType.unitSymbol}`; // Add a space for better formatting
    }
    // Fallback to default logic if not found or no unitSymbol defined for the custom type
    const typeToUse = bandConditionType || kpiInputType;
    switch (typeToUse) {
        case 'percentage':
        case 'percentage_compliance':
            return ' %'; // Added space
        case 'duration_days':
            return ' days';
        case 'duration_hours':
            return ' hrs';
        case 'duration_minutes':
            return ' mins';
        case 'number':
            return ''; 
        default:
            return ''; // Default for unknown or custom types without a symbol
    }
}

// ... (rest of script.js, including renderAddEditKpiForm which uses getUnitForBandInput)

function triggerCSVDownload(csvString, filename) {
    console.log("[triggerCSVDownload] Attempting to download:", filename);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Check for download attribute support
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        // Fallback for older browsers (less common now)
        alert("CSV download is not supported in your browser. Please try a modern browser.");
    }
}

function generateIndividualReportCSV(records, employeeName, roleName) {
    if (!records || records.length === 0) return '';

    let csvString = '';
    // Define headers
    const headers = [
        'Record Period', 'Submission Timestamp', 'Total Score', 'Final Grade',
        'KPI Name', 'KPI Weightage', 'KPI Actual Result', 'KPI Sub-Grade', 'KPI Subtotal Score'
    ];
    csvString += headers.join(',') + '\r\n';

    // Add data rows
    records.forEach(record => {
        const recordPeriod = record.period || 'N/A';
        const submissionTimestamp = record.submissionTimestamp ? new Date(record.submissionTimestamp).toLocaleString() : 'N/A';
        const totalScore = record.totalScore !== undefined ? record.totalScore.toFixed(2) : 'N/A';
        const finalGrade = record.finalGrade || 'N/A';

        if (record.kpiDetails && record.kpiDetails.length > 0) {
            record.kpiDetails.forEach(kpi => {
                const row = [
                    `"${recordPeriod}"`, // Enclose in quotes if they might contain commas or newlines, though unlikely here
                    `"${submissionTimestamp}"`,
                    `"${totalScore}"`,
                    `"${finalGrade}"`,
                    `"${kpi.name || 'N/A'}"`,
                    `"${kpi.weightage !== undefined ? kpi.weightage : 'N/A'}"`,
                    `"${kpi.actualResult !== undefined ? (typeof kpi.actualResult === 'number' ? kpi.actualResult.toFixed(2) : kpi.actualResult) : 'N/A'}"`,
                    `"${kpi.subGrade !== undefined ? kpi.subGrade : 'N/A'}"`,
                    `"${kpi.subtotalScore !== undefined ? (typeof kpi.subtotalScore === 'number' ? kpi.subtotalScore.toFixed(2) : kpi.subtotalScore) : 'N/A'}"`
                ];
                csvString += row.join(',') + '\r\n';
            });
        } else {
            // Row for records with no KPI details (less common, but good to handle)
            const row = [
                `"${recordPeriod}"`,
                `"${submissionTimestamp}"`,
                `"${totalScore}"`,
                `"${finalGrade}"`,
                'N/A', 'N/A', 'N/A', 'N/A', 'N/A' // Placeholders for KPI columns
            ];
            csvString += row.join(',') + '\r\n';
        }
    });
    return csvString;
}

function generateRoleComparisonReportCSV(recordsToCompare, roleName, comparisonPeriod) {
    if (!recordsToCompare || recordsToCompare.length === 0) return '';

    let csvString = '';
    // Define headers for the summary table
    const headers = [
        'Rank', 'Employee Name', 'Employee ID', 'Total Score', 'Final Grade'
    ];
    csvString += headers.join(',') + '\r\n';

    // Add data rows
    recordsToCompare.forEach((record, index) => {
        const rank = index + 1;
        const employeeName = record.employeeName || 'N/A';
        const employeeId = record.employeeId || 'N/A';
        const totalScore = record.totalScore !== undefined ? record.totalScore.toFixed(2) : 'N/A';
        const finalGrade = record.finalGrade || 'N/A';

        const row = [
            `"${rank}"`, 
            `"${employeeName}"`,
            `"${employeeId}"`,
            `"${totalScore}"`,
            `"${finalGrade}"`
        ];
        csvString += row.join(',') + '\r\n';
    });
    return csvString;
}

function generateEmployeeCompetencyReportCSV(filteredEmpData) {
    if (!filteredEmpData || filteredEmpData.length === 0) return '';

    let csvString = '';
    const headers = [
        'Employee ID', 'Employee Name', 'Role', 'Department',
        'Competency Category', 'Competency Type', 'Assessed Level', 'Max Level (Scale)',
        'Level Definition', 'Evidence/Comments', 'Assessment Date'
    ];
    csvString += headers.join(',') + '\r\n';

    const categoriesMap = new Map(configurableCompetencyCategories.map(cat => [cat.id, cat.name]));
    const typesMap = new Map();
    configurableCompetencyCategories.forEach(cat => {
        (cat.types || []).forEach(type => {
            typesMap.set(type.id, { 
                name: type.name, 
                levelScale: type.levelScale || 7, 
                levelDescriptions: type.levelDescriptions || [],
                description: type.description || '' // Also include type description
            });
        });
    });

    filteredEmpData.forEach(emp => {
        if (emp.assessedCompetencies && emp.assessedCompetencies.length > 0) {
            emp.assessedCompetencies.forEach(ac => {
                const categoryName = categoriesMap.get(ac.categoryId) || 'Unknown Category';
                const typeDetails = typesMap.get(ac.competencyTypeId) || { name: 'Unknown Type', levelScale: 7, levelDescriptions: [], description: 'N/A' };
                const levelDescription = (Array.isArray(typeDetails.levelDescriptions) && ac.assessedLevel && typeDetails.levelDescriptions[ac.assessedLevel -1]) 
                                      ? (typeDetails.levelDescriptions[ac.assessedLevel -1] || 'N/A') 
                                      : 'N/A';
                const evidence = ac.evidence ? ac.evidence.replace(/"/g, '""').replace(/\r?\n/g, ' ') : 'N/A'; // Escape quotes and newlines for CSV

                const row = [
                    `"${emp.id || 'N/A'}"`,
                    `"${emp.name || 'N/A'}"`,
                    `"${emp.role || 'N/A'}"`,
                    `"${emp.department || 'N/A'}"`,
                    `"${categoryName}"`,
                    `"${typeDetails.name}"`,
                    `"${ac.assessedLevel || 'N/A'}"`,
                    `"${typeDetails.levelScale}"`,
                    `"${levelDescription.replace(/"/g, '""')}"`, 
                    `"${evidence}"`,
                    `"${ac.assessmentDate ? new Date(ac.assessmentDate).toLocaleDateString() : 'N/A'}"`
                ];
                csvString += row.join(',') + '\r\n';
            });
        }
    });
    return csvString;
}

function displayRolePerformanceComparison(selectedRoleName) {
    const displayArea = document.getElementById('report-display-area');
    if (!displayArea) { console.error("Report display area not found."); return; }
    displayArea.innerHTML = ''; 

    const roleComparisonPeriodInput = document.getElementById('role-comparison-period-select');
    const selectedPeriodByUser = roleComparisonPeriodInput ? roleComparisonPeriodInput.value : null;
    
    console.log(`[displayRolePerformanceComparison] Role: "${selectedRoleName}". User selected period: "${selectedPeriodByUser}"`);

    let recordsToCompare = [];
    let comparisonPeriodForDisplay = '';
    let allRecordsForThisRole = performanceRecords.filter(record => record.roleName === selectedRoleName);

    if (allRecordsForThisRole.length === 0) {
        displayArea.innerHTML = `<p>No performance data found for role: <strong>${selectedRoleName}</strong>.</p>`;
        return;
    }

    if (selectedPeriodByUser) { 
        recordsToCompare = allRecordsForThisRole.filter(record => record.period === selectedPeriodByUser);
        comparisonPeriodForDisplay = selectedPeriodByUser;
        if (recordsToCompare.length === 0) {
            displayArea.innerHTML = `<p>No performance data found for role: <strong>${selectedRoleName}</strong> in period <strong>${selectedPeriodByUser}</strong>.</p>`;
            return;
        }
    } else { 
        let latestPeriod = '0000-00';
        allRecordsForThisRole.forEach(record => { if (record.period > latestPeriod) { latestPeriod = record.period; } });
        if (latestPeriod === '0000-00') {
            displayArea.innerHTML = `<p>Could not determine any performance period for <strong>${selectedRoleName}</strong>.</p>`;
            return;
        }
        recordsToCompare = allRecordsForThisRole.filter(record => record.period === latestPeriod);
        comparisonPeriodForDisplay = latestPeriod + " (Latest)";
         if (recordsToCompare.length === 0) { 
            displayArea.innerHTML = `<p>No records found for the latest identified period (${latestPeriod}) for role <strong>${selectedRoleName}</strong>.</p>`;
            return;
        }
    }

    recordsToCompare.sort((a, b) => b.totalScore - a.totalScore);

    let reportHTML = `
        <h4 style="margin-bottom:15px;">Role Performance Comparison: ${selectedRoleName} (Period: ${comparisonPeriodForDisplay})</h4>
        <table class="comparison-table" style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color:#f0f0f0;">
                    <th style="padding:8px; border:1px solid #ddd; text-align:left;">Rank</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:left;">Employee Name</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:left;">Employee ID</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:right;">Total Score</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:left;">Final Grade</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:center;">KPI Details</th>
                </tr>
            </thead>
            <tbody>
    `;
    recordsToCompare.forEach((record, index) => {
        const detailsDivId = `compare-details-${selectedRoleName.replace(/\s+/g, '-')}-${record.period.replace('-','')}-${record.employeeId}-${index}`;
        reportHTML += `
            <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9f9f9'};">
                <td style="padding:8px; border:1px solid #ddd;">${index + 1}</td>
                <td style="padding:8px; border:1px solid #ddd;">${record.employeeName}</td>
                <td style="padding:8px; border:1px solid #ddd;">${record.employeeId}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">${record.totalScore.toFixed(2)}</td>
                <td style="padding:8px; border:1px solid #ddd;">${record.finalGrade}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center;">
                    <button class="view-compare-kpi-details-button" 
                            data-record-original-idx="${performanceRecords.indexOf(record)}" 
                            data-details-target-id="${detailsDivId}"
                            style="padding: 5px 8px; font-size:0.85em;">View Details</button>
                </td>
            </tr>
            <tr class="kpi-details-row" style="background-color: ${index % 2 === 0 ? '#f0f8ff' : '#e6f2ff'};">
                 <td colspan="6" style="padding:0; border:1px solid #ddd; border-top:none;">
                    <div class="record-kpi-details-compare" id="${detailsDivId}" style="display:none; padding:10px;">
                    </div>
                </td>
            </tr>
        `;
    });
    reportHTML += `</tbody></table>`;
    displayArea.innerHTML = reportHTML;

    // Re-attach event listeners for view details (same logic as before)
    document.querySelectorAll('.view-compare-kpi-details-button').forEach(button => {
        // ... (existing view details logic remains the same) ...
        button.addEventListener('click', (event) => {
            const btn = event.target;
            const originalRecordIndex = parseInt(btn.dataset.recordOriginalIdx);
            const specificRecord = performanceRecords[originalRecordIndex];
            const targetDivId = btn.dataset.detailsTargetId;
            const detailsDiv = document.getElementById(targetDivId);
            if (detailsDiv && specificRecord && specificRecord.kpiDetails) {
                if (detailsDiv.style.display === 'none') {
                    let kpiDetailsHTML = '<h5>KPI Breakdown:</h5><ul style="list-style:none; padding-left:0;">';
                    specificRecord.kpiDetails.forEach(kpi => {
                        kpiDetailsHTML += `<li style="margin-bottom:4px; padding: 3px; background-color: #fff; border-radius:3px;">
                            <strong>${kpi.name}:</strong> 
                            Actual: ${kpi.actualResult === 'N/A' || typeof kpi.actualResult === 'undefined' ? 'N/A' : (typeof kpi.actualResult === 'number' ? kpi.actualResult.toFixed(2) : kpi.actualResult)}, 
                            Sub-Grade: ${kpi.subGrade}, 
                            Score: ${kpi.subtotalScore === 'N/A' || typeof kpi.subtotalScore === 'undefined' ? 'N/A' : (typeof kpi.subtotalScore === 'number' ? kpi.subtotalScore.toFixed(2) : kpi.subtotalScore)} (Weightage: ${kpi.weightage}%)
                        </li>`;
                    });
                    kpiDetailsHTML += '</ul>';
                    detailsDiv.innerHTML = kpiDetailsHTML;
                    detailsDiv.style.display = 'block';
                    btn.textContent = 'Hide Details';
                } else {
                    detailsDiv.innerHTML = '';
                    detailsDiv.style.display = 'none';
                    btn.textContent = 'View Details';
                }
            } else {
                detailsDiv.innerHTML = '<p>Could not load KPI details for this record.</p>';
                detailsDiv.style.display = 'block';
                btn.textContent = 'Details Error';
                btn.disabled = true;
            }
        });
    });

    // Add event listeners for new Role Comparison action buttons
    const downloadCSVRoleButton = document.getElementById('download-csv-role-comparison');
    if (downloadCSVRoleButton) {
        downloadCSVRoleButton.addEventListener('click', () => {
            const filename = `Role_Comparison_${selectedRoleName.replace(/\s+/g, '_')}_${comparisonPeriodForDisplay.replace(/\s*\(Latest\)\s*/, '').replace(/\s+/g, '_')}.csv`;
            const csvData = generateRoleComparisonReportCSV(recordsToCompare, selectedRoleName, comparisonPeriodForDisplay);
            if (csvData) {
                triggerCSVDownload(csvData, filename);
        } else {
                alert('No data available to download for the current role comparison.');
            }
        });
    }

    const downloadExcelRoleButton = document.getElementById('download-excel-role-comparison');
    if (downloadExcelRoleButton) {
        downloadExcelRoleButton.addEventListener('click', () => {
            const filename = `Role_Comparison_${selectedRoleName.replace(/\s+/g, '_')}_${comparisonPeriodForDisplay.replace(/\s*\(Latest\)\s*/, '').replace(/\s+/g, '_')}.csv`;
            const csvData = generateRoleComparisonReportCSV(recordsToCompare, selectedRoleName, comparisonPeriodForDisplay);
            if (csvData) {
                triggerCSVDownload(csvData, filename);
            } else {
                alert('No data available to download for the current role comparison.');
            }
        });
    }

    const printReportRoleButton = document.getElementById('print-report-role-comparison');
    if (printReportRoleButton) {
        printReportRoleButton.addEventListener('click', () => {
            window.print();
        });
    }
}

// ... (rest of script.js)

// Inserting the renderAddEditEmployeeForm function definition.
// Ensure this function is placed before it's called by other functions like renderEmployeeSection or renderEmployeeList.

// MANUALLY REPLACE your existing renderAddEditEmployeeForm function with this:

// Original function: function renderAddEditEmployeeForm(formContainer, employeeIndex = null, mainListContainerForRefresh) {
// We'll change employeeIndex to employeeIdToEdit for clarity when editing with Firestore IDs.
// If employeeIdToEdit is null, it's an "add" operation.
async function renderAddEditEmployeeForm(formContainer, employeeIdToEdit = null, mainListContainerForRefresh) {
    if (!formContainer) {
        console.error("[renderAddEditEmployeeForm] Form container not found.");
        return;
    }
    const isEditing = employeeIdToEdit !== null;
    const employee = isEditing ? employeeData.find(emp => emp.id === employeeIdToEdit) : null;

    if (isEditing && !employee) {
        alert("Error: Employee to edit not found in local data. Please refresh.");
        console.error(`[renderAddEditEmployeeForm] Employee with ID ${employeeIdToEdit} not found for editing.`);
        return;
    }

    console.log(`[renderAddEditEmployeeForm] Called. Editing: ${isEditing}, Employee ID: ${employeeIdToEdit}`);

    const roleNames = currentKpiData.map(role => role.roleName);

    if (roleNames.length === 0) {
        alert("No roles configured. Please add roles in Settings before adding/editing employees.");
        // Consider redirecting or providing a link to settings
        formContainer.innerHTML = '<p>No roles configured. Please <a href="#" onclick="showSection(settingsSection); renderSettings(); return false;">add roles in Settings</a> before adding/editing employees.</p>';
        formContainer.style.display = 'block';
        return;
    }
    
    let departmentOptionsHTML = '';
    if (configurableDepartments && configurableDepartments.length > 0) {
        departmentOptionsHTML = configurableDepartments.map(dept => 
            `<option value="${dept.name}" ${employee && employee.department === dept.name ? 'selected' : ''}>${dept.name}</option>`
        ).join('');
        departmentOptionsHTML = '<option value="">-- Select a Department --</option>' + departmentOptionsHTML;
    } else {
        departmentOptionsHTML = '<option value="" disabled>No departments configured. Add them in Settings.</option>';
    }

    const employeeCodeValue = employee ? (employee.employeeCode || employee.id || '') : '';
    // Using a more stable prefix for elements within this specific form instance,
    // Date.now() is good for the container's dynamic part if needed, but not for internal elements we target.
    const formElementIdPrefix = `employee-form-${isEditing ? (employee.id || 'edit').replace(/[^a-zA-Z0-9-_]/g, '') : 'new'}`;


    let formHTML = `
        <h4>${isEditing ? 'Edit Employee' : 'Add New Employee'}</h4>
        <div class="kpi-form-field">
            <label for="${formElementIdPrefix}-code">Employee Code/ID:</label>
            <input type="text" id="${formElementIdPrefix}-code" value="${employeeCodeValue}" ${isEditing && employee.employeeCode ? 'readonly' : ''} required>
            ${isEditing && employee.employeeCode ? '<small>Employee Code cannot be changed.</small>' : (isEditing && employee.id ? '<small>Firestore ID (readonly): ' + employee.id + '</small>' : '<small>Enter a unique company ID/code.</small>')}
        </div>
        <div class="kpi-form-field">
            <label for="${formElementIdPrefix}-name\">Employee Name:</label>
            <input type="text" id="${formElementIdPrefix}-name" value="${employee ? employee.name : ''}" required>
        </div>
        <div class="kpi-form-field">
            <label for="${formElementIdPrefix}-role">Role:</label>
            <select id="${formElementIdPrefix}-role" required>
                <option value="">-- Select a Role --</option>
                ${roleNames.map(roleName => `<option value="${roleName}" ${employee && employee.role === roleName ? 'selected' : ''}>${roleName}</option>`).join('')}
            </select>
        </div>
        <div class="kpi-form-field">
            <label for="${formElementIdPrefix}-department">Department:</label>
            <select id="${formElementIdPrefix}-department" ${configurableDepartments.length === 0 ? 'disabled' : ''}>
                ${departmentOptionsHTML}
            </select>
            ${configurableDepartments.length === 0 ? '<p style="font-size:0.85em; color:orange; margin-top:5px;">Please set up Departments in Settings first to assign one.</p>' : ''}
        </div>
        <div style="margin-top: 20px;">
            <button id="${formElementIdPrefix}-save-button">${isEditing ? 'Save Changes' : 'Add Employee'}</button>
            <button type="button" id="${formElementIdPrefix}-cancel-button" class="cancel-button">Cancel</button>
        </div>
    `;

    formContainer.innerHTML = formHTML;
    formContainer.style.display = 'block';

    const saveButton = document.getElementById(`${formElementIdPrefix}-save-button`);
    const cancelButton = document.getElementById(`${formElementIdPrefix}-cancel-button`);
    const employeeCodeInput = document.getElementById(`${formElementIdPrefix}-code`);
    const employeeNameInput = document.getElementById(`${formElementIdPrefix}-name`);
    const selectedRoleSelect = document.getElementById(`${formElementIdPrefix}-role`);
    const selectedDepartmentSelect = document.getElementById(`${formElementIdPrefix}-department`);

    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            formContainer.innerHTML = '';
            formContainer.style.display = 'none';
        });
    }
    
    let isSavingEmployee = false; // Gatekeeper flag

    if (saveButton && employeeCodeInput && employeeNameInput && selectedRoleSelect && selectedDepartmentSelect) {
        saveButton.addEventListener('click', async () => {
            if (isSavingEmployee) {
                console.warn("[renderAddEditEmployeeForm] Save already in progress. Ignoring click.");
                return;
            }
            isSavingEmployee = true;

            try { // Wrap in try...finally to ensure isSavingEmployee is reset
                const employeeCode = employeeCodeInput.value.trim();
                const employeeName = employeeNameInput.value.trim();
                const selectedRole = selectedRoleSelect.value;
                const selectedDepartment = selectedDepartmentSelect.value;

                if (!employeeCode && !isEditing) { // For new employees, code is mandatory
                    alert("Employee Code/ID cannot be empty when adding.");
                    // isSavingEmployee = false; // This will be handled by finally
                    return;
                }
                if (!employeeName) {
                    alert("Employee Name cannot be empty.");
                    // isSavingEmployee = false;
                    return;
                }
                if (!selectedRole) {
                    alert("Please select a role for the employee.");
                    // isSavingEmployee = false;
                    return;
                }
                if (configurableDepartments.length > 0 && !selectedDepartment) {
                    alert("Please select a department for the employee.");
                    // isSavingEmployee = false;
                    return;
                }

                let employeeObject = {
                    employeeCode: employeeCode, // This is the user-defined code
                    name: employeeName,
                    role: selectedRole,
                    department: configurableDepartments.length > 0 ? selectedDepartment : '',
                    assessedCompetencies: (isEditing && employee && employee.assessedCompetencies) ? employee.assessedCompetencies : []
                };

                if (isEditing) {
                    if (employee && employee.id) { // Ensure we have the Firestore document ID
                        employeeObject.id = employee.id; // Add Firestore document ID for update

                        const updatedEmployee = await saveEmployee(employeeObject);
                        if (updatedEmployee) {
                            alert('Employee details updated successfully!');
                        } else {
                            alert('Error updating employee. Check console.');
                            // isSavingEmployee = false; // Handled by finally
                            return; // Stop further processing on error
                        }
                    } else {
                        alert('Error updating employee: Missing Firestore document ID.');
                        console.error('Error updating employee: Missing employee.id for editing.');
                        // isSavingEmployee = false; // Handled by finally
                        return; 
                    }
                } else { // ADDING NEW EMPLOYEE
                    // The duplicate employeeCode check is now handled by the addEmployee function using a transaction.
                    
                    const addedEmployee = await addEmployee(employeeObject); // employeeObject contains .employeeCode
                    
                    if (addedEmployee) {
                        alert('Employee added successfully!');
                        // UI will be updated by the calling code after this block
                    } else {
                        // addEmployee function now shows its own more specific alerts.
                        // The 'isSavingEmployee' flag is reset in the 'finally' block.
                        return; // Stop further processing on error
                    }
                }
                
                formContainer.innerHTML = '';
                formContainer.style.display = 'none';
                
                if(mainListContainerForRefresh){
                    renderEmployeeList(mainListContainerForRefresh);
                } else { 
                    const defaultListContainer = document.getElementById('employee-list-container');
                    if (defaultListContainer) renderEmployeeList(defaultListContainer);
                }
            } finally {
                isSavingEmployee = false; // Reset the flag regardless of success or failure
            }
        });
    } else {
        console.error("[renderAddEditEmployeeForm] Could not attach save listener: one or more critical form elements not found.");
    }
}
// The rest of script.js should follow or precede this, ensuring function scope and call order are correct.

// --- Department Management Functions ---
async function loadDepartments() { // Made async
    configurableDepartments = []; // Clear local array
    try {
        const querySnapshot = await getDocs(collection(db, "departments"));
        if (querySnapshot.empty) {
            console.warn("No departments found in Firestore. Initializing with defaults and saving.");
            const defaultDepartments = [
                { id: 'dept_g_001', name: 'General', assignedRoles: [] },
                { id: 'dept_s_002', name: 'Sales', assignedRoles: [] },
                { id: 'dept_m_003', name: 'Marketing', assignedRoles: [] },
                { id: 'dept_t_004', name: 'Technology', assignedRoles: [] },
                { id: 'dept_h_005', name: 'Human Resources', assignedRoles: [] }
            ];
            // Save these defaults to Firestore
            const batch = writeBatch(db);
            defaultDepartments.forEach(dept => {
                const docRef = doc(db, "departments", dept.id); // Use predefined IDs for defaults
                batch.set(docRef, dept);
            });
            await batch.commit();
            configurableDepartments = defaultDepartments;
            console.log('Initialized and saved default departments to Firestore.');
        } else {
            querySnapshot.forEach((docSnap) => {
                // Ensure assignedRoles exists and is an array for each loaded department
                const data = docSnap.data();
                configurableDepartments.push({ 
                    id: docSnap.id, 
                    ...data,
                    assignedRoles: Array.isArray(data.assignedRoles) ? data.assignedRoles : []
                });
            });
        }
    } catch (error) {
        console.error('Error loading departments from Firestore:', error);
        // Fallback or error display - providing a minimal fallback
        configurableDepartments = [ { id: 'fallback_dept_error', name: 'Error Loading Departments', assignedRoles: [] } ];
    }
    console.log('Configurable departments loaded:', configurableDepartments);
}

function renderDepartmentSetupForm(container, editModeData = null) {
    console.log("[renderDepartmentSetupForm] Called. Edit Mode:", editModeData);
    if (!container) { console.error("[renderDepartmentSetupForm] Container not found."); return; }

    const isEditing = editModeData !== null;
    const editingDeptId = isEditing ? editModeData.id : null;
    const currentName = isEditing ? editModeData.name : '';
    const currentAssignedRolesForThisDept = isEditing ? (editModeData.assignedRoles || []) : [];

    // Build a map of all roles already assigned to any department for quick lookup
    const assignedRolesMap = new Map(); // roleName -> departmentName
    configurableDepartments.forEach(dept => {
        if (dept.id !== editingDeptId) { // Exclude the current department being edited from this map
            (dept.assignedRoles || []).forEach(roleName => {
                if (!assignedRolesMap.has(roleName)) {
                    assignedRolesMap.set(roleName, dept.name);
                }
            });
        }
    });

    let formHTML = `<h3>Manage Departments</h3>
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; background-color: #f8f8f8; border-radius: 4px;">
            <h4>${isEditing ? 'Edit Department' : 'Add New Department'}</h4>
            <input type="hidden" id="department-id-for-edit" value="${editingDeptId || ''}">
            <div class="kpi-form-field">
                <label for="department-name-input">Department Name:</label>
                <input type="text" id="department-name-input" placeholder="Enter department name" value="${currentName}">
            </div>
            
            <div class="kpi-form-field" style="margin-top:15px;">
                <label style="display:block; margin-bottom:5px;">Assign Roles to this Department (a role can only be in one department):</label>
                <div id="department-role-assignment-checkboxes" style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; background-color:white;">`;

    if (currentKpiData.length === 0) {
        formHTML += '<p style="font-style:italic; color:#777;">No roles configured yet. Please set up roles first in Role Setup.</p>';
                } else {
        currentKpiData.forEach(role => {
            const roleName = role.roleName;
            const isChecked = currentAssignedRolesForThisDept.includes(roleName);
            let isDisabled = false;
            let disabledReason = '';

            if (assignedRolesMap.has(roleName) && !isChecked) {
                // Role is assigned to another department AND not currently assigned to this one (if editing)
                isDisabled = true;
                disabledReason = ` (Assigned to: ${assignedRolesMap.get(roleName)})`;
            }
            
            const inputId = `dept-role-${roleName.replace(/\s+/g, '-')}`;
            formHTML += `<div style="margin-bottom:5px; ${isDisabled ? 'opacity:0.6;' : ''}">
                            <input type="checkbox" id="${inputId}" name="departmentRole" value="${roleName}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                            <label for="${inputId}" style="margin-left:5px;">${roleName}</label>
                            ${isDisabled ? `<small style=\"font-style:italic; color:#777; margin-left:5px;\">${disabledReason}</small>` : ''}
                         </div>`;
        });
    }

    formHTML += `    </div>
            </div>
            <button id="save-department-button" class="setting-button" style="margin-top:15px;">${isEditing ? 'Save Changes' : 'Add Department'}</button>
            ${isEditing ? '<button id="cancel-edit-department-button" type="button" class="setting-button-secondary" style="margin-left:10px;">Cancel Edit</button>' : ''}
        </div>
        <h4>Existing Departments</h4>
        <ul id="existing-departments-list" style="list-style: none; padding: 0;">`;

    // ... (Listing existing departments - this part remains the same, showing roles assigned)
    if (configurableDepartments.length === 0 && !isEditing) {
        formHTML += '<p>No departments found. Add one above.</p>';
    }
    configurableDepartments.forEach((dept) => {
        if (!(isEditing && dept.id === editingDeptId)) {
            const assignedRolesDisplay = dept.assignedRoles && dept.assignedRoles.length > 0 
                ? ` (Roles: ${dept.assignedRoles.join(', ')})` 
                : ' (No roles assigned)';
            formHTML += `<li style="margin-bottom: 10px; padding: 10px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                            <span>${dept.name} <small style="color:#555;">${assignedRolesDisplay}</small></span>
                            <div>
                                <button class="edit-department-button setting-button-small" data-dept-id="${dept.id}" style="margin-right:5px;">Edit</button>
                                <button class="delete-department-button setting-button-small danger" data-dept-id="${dept.id}">Delete</button>
                            </div>
                        </li>`;
        }
    });
    formHTML += `</ul>`;
    container.innerHTML = formHTML;

    const saveDeptButton = document.getElementById('save-department-button');
    const deptNameInput = document.getElementById('department-name-input');

    if (saveDeptButton && deptNameInput) {
        saveDeptButton.addEventListener('click', async () => { // MADE ASYNC
            const newDeptName = deptNameInput.value.trim();
            if (!newDeptName) { alert('Department name cannot be empty.'); return; }

            const selectedRoleCheckboxes = document.querySelectorAll('#department-role-assignment-checkboxes input[name="departmentRole"]:checked');
            const newlyAssignedRolesToCurrentDept = Array.from(selectedRoleCheckboxes).map(cb => cb.value);

            // Before saving, unassign these roles from any other department they might currently belong to.
            configurableDepartments.forEach(otherDept => {
                if (editingDeptId === null || otherDept.id !== editingDeptId) { // Don't modify the department currently being edited (yet)
                    if (otherDept.assignedRoles && otherDept.assignedRoles.length > 0) {
                        otherDept.assignedRoles = otherDept.assignedRoles.filter(roleName => 
                            !newlyAssignedRolesToCurrentDept.includes(roleName)
                        );
                    }
                }
            });

            if (isEditing) {
                const deptIdToUpdate = document.getElementById('department-id-for-edit').value;
                const deptIndex = configurableDepartments.findIndex(d => d.id === deptIdToUpdate);
                if (deptIndex === -1) { alert("Error updating department. Not found."); return; }
                if (newDeptName.toLowerCase() !== configurableDepartments[deptIndex].name.toLowerCase() && 
                    configurableDepartments.some(d => d.id !== deptIdToUpdate && d.name.toLowerCase() === newDeptName.toLowerCase())) {
                    alert(`A department named "${newDeptName}" already exists.`); return;
                }
                configurableDepartments[deptIndex].name = newDeptName;
                configurableDepartments[deptIndex].assignedRoles = newlyAssignedRolesToCurrentDept;
                alert('Department updated successfully!');
            } else { // Adding new
                if (configurableDepartments.some(d => d.name.toLowerCase() === newDeptName.toLowerCase())) {
                    alert(`A department named "${newDeptName}" already exists.`); return;
                }
                const newDeptId = 'dept_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                configurableDepartments.push({ id: newDeptId, name: newDeptName, assignedRoles: newlyAssignedRolesToCurrentDept });
                alert('Department added successfully!');
            }
            // persistDepartments(); // OLD localStorage call
            await persistCollection('departments', configurableDepartments); // NEW: Persist to Firestore
            renderDepartmentSetupForm(container); 
        });
    }
    // ... (Cancel, Edit button event listeners remain largely the same)
    if (isEditing) {
        const cancelDeptButton = document.getElementById('cancel-edit-department-button');
        if (cancelDeptButton) {
            cancelDeptButton.addEventListener('click', () => renderDepartmentSetupForm(container));
        }
    }
    document.querySelectorAll('.edit-department-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const deptIdToEdit = event.target.dataset.deptId;
            const deptToEdit = configurableDepartments.find(d => d.id === deptIdToEdit);
            if (deptToEdit) renderDepartmentSetupForm(container, deptToEdit);
        });
    });
    document.querySelectorAll('.delete-department-button').forEach(button => {
        button.addEventListener('click', async (event) => {
          const deptIdToDelete = event.target.dataset.deptId;
          const deptBeingDeleted = configurableDepartments.find(d => d.id === deptIdToDelete);
          if (!deptBeingDeleted) return;
          if (!confirm(`Delete department "${deptBeingDeleted.name}" and reset employees?`)) return;
      
          // update local arrays
          configurableDepartments = configurableDepartments.filter(d => d.id !== deptIdToDelete);
          employeeData.forEach(emp => {
            if (emp.department === deptBeingDeleted.name) emp.department = '';
          });
      
          // bulk-write both collections in one go:
          await persistCollection('employees', employeeData);
          await persistCollection('departments', configurableDepartments);
      
          // re-render UI
          renderDepartmentSetupForm(container);
          renderAddEditEmployeeFormPopulateDepartments();
        });
      });
    };

// loadDepartments remains the same (it already initializes assignedRoles: [])
// persistDepartments remains the same
// No changes needed for renderAddEditEmployeeForm or other parts of script.js for this specific enhancement.

// Helper to refresh employee form department list if it's open
function renderAddEditEmployeeFormPopulateDepartments() {
    const formContainer = document.getElementById('add-edit-employee-form-container');
    // Check if the employee form is actually visible and contains a department select
    if (formContainer && formContainer.style.display !== 'none') { // Simplified check
        const deptSelect = formContainer.querySelector('select[id*="-department"]');
        if (deptSelect) { // Ensure deptSelect is found
            const currentSelectedDeptValue = deptSelect.value;
            
            let departmentOptionsHTML = configurableDepartments.map(dept => 
                `<option value="${dept.name}" ${currentSelectedDeptValue === dept.name ? 'selected' : ''}>${dept.name}</option>`
            ).join('');

            if (configurableDepartments.length === 0) {
                departmentOptionsHTML = '<option value="">-- No Departments Configured --</option>';
                deptSelect.disabled = true; // Disable if no departments
            } else {
                departmentOptionsHTML = '<option value="">-- Select a Department --</option>' + departmentOptionsHTML;
                deptSelect.disabled = false; // Enable if there are departments
            }
            deptSelect.innerHTML = departmentOptionsHTML;
            console.log("[renderAddEditEmployeeFormPopulateDepartments] Employee form department dropdown refreshed.");
        }
    }
}

// Near other global data stores
let configurableCompetencyCategories = [];

// --- Competency Category Management Functions ---
async function loadCompetencyCategories() { // Made async
    configurableCompetencyCategories = []; // Clear local array
    try {
        const querySnapshot = await getDocs(collection(db, "competencyCategories"));
        if (querySnapshot.empty) {
            console.warn("No competency categories found in Firestore. Initializing with defaults and saving.");
            const defaultCategories = [
                { id: 'cat_tech_001', name: 'Technical Skills', types: [] },
                { id: 'cat_soft_002', name: 'Soft Skills', types: [] },
                { id: 'cat_lead_003', name: 'Leadership Qualities', types: [] }
            ].map(cat => ({...cat, types: cat.types.map(t => ({...t, levelScale: 7, levelDescriptions:[], taggedDepartments:[], taggedRoleNames:[] }) ) }));

            const batch = writeBatch(db);
            defaultCategories.forEach(cat => {
                const docRef = doc(db, "competencyCategories", cat.id);
                batch.set(docRef, cat);
            });
            await batch.commit();
            configurableCompetencyCategories = defaultCategories;
            console.log('Initialized and saved default competency categories to Firestore.');
        } else {
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                configurableCompetencyCategories.push({
                    id: docSnap.id,
                    ...data,
                    types: Array.isArray(data.types) ? data.types.map(type => ({
                        ...type,
                        levelScale: type.levelScale || 7,
                        levelDescriptions: Array.isArray(type.levelDescriptions) ? type.levelDescriptions : [],
                        taggedDepartments: Array.isArray(type.taggedDepartments) ? type.taggedDepartments : [],
                        taggedRoleNames: Array.isArray(type.taggedRoleNames) ? type.taggedRoleNames : []
                    })) : []
                });
            });
        }
    } catch (error) {
        console.error('Error loading competency categories from Firestore:', error);
        // Fallback or error display
        configurableCompetencyCategories = [ { id: 'fallback_cat_error', name: 'Error Loading Categories', types: [] } ];
    }
    console.log('Configurable competency categories loaded:', configurableCompetencyCategories);
}


// renderSettings() function needs to be updated as described previously to include 'competencySetup'
// displaySettingInputs() function needs to be updated as described previously for 'competencySetup'
// DOMContentLoaded listener needs loadCompetencyCategories();

function renderCompetencySetupPage(container) {
    console.log("[renderCompetencySetupPage] Called.");
    if (!container) { console.error("[renderCompetencySetupPage] Container not found."); return; }

    let pageHTML = `<h2>Competency Setup</h2>
        <p>Define competency categories, then manage specific competencies (types) within each category, optionally tagging them to departments and roles.</p>
        <div id="competency-category-management-container" style="margin-bottom: 30px; padding-bottom:20px; border-bottom: 2px solid #ccc;">
            <!-- Category CRUD UI will be rendered here -->
        </div>
        <div id="competency-type-management-container" style="display:none; margin-top:20px;">
             <!-- Types CRUD UI for a selected category will go here -->
        </div>
    `;
    container.innerHTML = pageHTML;
    renderCompetencyCategoryManagement(document.getElementById('competency-category-management-container'));
}

function renderCompetencyCategoryManagement(container, editModeData = null) {
    console.log("[renderCompetencyCategoryManagement] Called. Edit Mode:", editModeData);
    if (!container) { console.error("[renderCompetencyCategoryManagement] Category management container not found."); return; }

    const isEditingCategory = editModeData !== null;
    const editingCategoryId = isEditingCategory ? editModeData.id : null;
    const currentCategoryName = isEditingCategory ? editModeData.name : '';

    let formHTML = `<h3>Manage Competency Categories</h3>
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; background-color: #f8f8f8; border-radius: 4px;">
            <h4>${isEditingCategory ? 'Edit Category Name' : 'Add New Category'}</h4>
            <input type="hidden" id="category-id-for-edit" value="${editingCategoryId || ''}">
        <div class="kpi-form-field">
                <label for="category-name-input">Category Name:</label>
                <input type="text" id="category-name-input" placeholder="E.g., Technical Skills" value="${currentCategoryName}">
        </div>
            <button id="save-category-button" class="setting-button" style="margin-top:10px;">${isEditingCategory ? 'Save Name Changes' : 'Add Category'}</button>
            ${isEditingCategory ? '<button id="cancel-edit-category-button" type="button" class="setting-button-secondary" style="margin-left:10px;">Cancel Edit</button>' : ''}
        </div>
        <h4>Existing Categories</h4>
        <ul id="existing-categories-list" style="list-style: none; padding: 0;">`;

    if (configurableCompetencyCategories.length === 0 && !isEditingCategory) {
        formHTML += '<p>No categories found. Add one above.</p>';
    }

    configurableCompetencyCategories.forEach((cat) => {
        if (!(isEditingCategory && cat.id === editingCategoryId)) {
            formHTML += `<li style="margin-bottom: 10px; padding: 10px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                            <span>${cat.name} <small style="color:#777;">(${(cat.types && cat.types.length) ? cat.types.length : 0} types)</small></span>
                            <div>
                                <button class="edit-category-button setting-button-small" data-cat-id="${cat.id}" style="margin-right:5px;">Edit Name</button>
                                <button class="manage-types-button setting-button-small" data-cat-id="${cat.id}" style="margin-right:5px;">Manage Types</button> 
                                <button class="delete-category-button setting-button-small danger" data-cat-id="${cat.id}">Delete Category</button>
                            </div>
                        </li>`;
        }
    });
    formHTML += `</ul>`;
    container.innerHTML = formHTML;

    const saveCatButton = document.getElementById('save-category-button');
    const catNameInput = document.getElementById('category-name-input');
    const typeManagementContainerGlobal = document.getElementById('competency-type-management-container');

    if (saveCatButton && catNameInput) {
        saveCatButton.addEventListener('click', async () => { // MADE ASYNC
            const newCatName = catNameInput.value.trim();
            if (!newCatName) { alert('Category name cannot be empty.'); return; }
            const editingCatIdFromForm = document.getElementById('category-id-for-edit').value;

            if (editingCatIdFromForm) {
                const catIndex = configurableCompetencyCategories.findIndex(c => c.id === editingCatIdFromForm);
                if (catIndex === -1) { alert('Error: Category to update not found.'); renderCompetencyCategoryManagement(container); return; }
                if (newCatName.toLowerCase() !== configurableCompetencyCategories[catIndex].name.toLowerCase() && 
                    configurableCompetencyCategories.some(c => c.id !== editingCatIdFromForm && c.name.toLowerCase() === newCatName.toLowerCase())) {
                    alert(`A category named "${newCatName}" already exists.`); return;
                }
                configurableCompetencyCategories[catIndex].name = newCatName;
                alert('Category name updated successfully!');
            } else {
                if (configurableCompetencyCategories.some(c => c.name.toLowerCase() === newCatName.toLowerCase())) {
                    alert(`A category named "${newCatName}" already exists.`); return;
                }
                const newCatId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                configurableCompetencyCategories.push({ id: newCatId, name: newCatName, types: [] });
                alert('Category added successfully!');
            }
            // persistCompetencyCategories(); // OLD localStorage call
            await persistCollection('competencyCategories', configurableCompetencyCategories); // NEW: Persist to Firestore
            renderCompetencyCategoryManagement(container); 
            if (typeManagementContainerGlobal) typeManagementContainerGlobal.style.display = 'none';
        });
    }

    if (isEditingCategory) {
        const cancelCatButton = document.getElementById('cancel-edit-category-button');
        if (cancelCatButton) {
            cancelCatButton.addEventListener('click', () => {
                renderCompetencyCategoryManagement(container);
                if (typeManagementContainerGlobal) typeManagementContainerGlobal.style.display = 'none';
        });
    }
}

    document.querySelectorAll('.edit-category-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const catIdToEdit = event.target.dataset.catId;
            const catToEdit = configurableCompetencyCategories.find(c => c.id === catIdToEdit);
            if (catToEdit) renderCompetencyCategoryManagement(container, catToEdit);
            if (typeManagementContainerGlobal) typeManagementContainerGlobal.style.display = 'none';
        });
    });

    document.querySelectorAll('.delete-category-button').forEach(button => {
        button.addEventListener('click', async (event) => { // MADE ASYNC
            const catIdToDelete = event.target.dataset.catId;
            const catBeingDeleted = configurableCompetencyCategories.find(c => c.id === catIdToDelete);
            if (catBeingDeleted && confirm(`Are you sure you want to delete the category "${catBeingDeleted.name}"? This will also delete all competency types defined within it.`)) {
                configurableCompetencyCategories = configurableCompetencyCategories.filter(c => c.id !== catIdToDelete);
                // persistCompetencyCategories(); // OLD localStorage call
                await persistCollection('competencyCategories', configurableCompetencyCategories); // NEW: Persist to Firestore
                renderCompetencyCategoryManagement(container);
                document.getElementById('competency-type-management-container').style.display = 'none'; // Hide types section
                // Later: also clear any employee competency data related to types from this category
            }
        });
    });
    
    // Placeholder for Manage Types button functionality - to be added later
    // document.querySelectorAll('.manage-types-button').forEach(button => { ... });

    document.querySelectorAll('.manage-types-button').forEach(button => {
        button.addEventListener('click', (event) => {
            console.log("[DEBUG] Manage Types button clicked! Category ID:", event.target.dataset.catId); // ADDED/MODIFIED LOG

            const categoryId = event.target.dataset.catId;
            const selectedCategory = configurableCompetencyCategories.find(cat => cat.id === categoryId);
            console.log("[DEBUG] Selected Category for types:", selectedCategory); // ADDED LOG
            
            const typeManagementContainerGlobal = document.getElementById('competency-type-management-container');
            console.log("[DEBUG] Type Management Container Element:", typeManagementContainerGlobal); // ADDED LOG

            if (selectedCategory) {
                if (typeManagementContainerGlobal) {
                    renderCompetencyTypeManagement(typeManagementContainerGlobal, selectedCategory);
                    typeManagementContainerGlobal.style.display = 'block';
                    console.log("[DEBUG] Type management container display set to block."); // ADDED LOG

                    document.querySelectorAll('#existing-categories-list li').forEach(li => li.style.backgroundColor = '#f9f9f9');
                    const clickedLi = event.target.closest('li');
                    if(clickedLi) clickedLi.style.backgroundColor = '#e0efff'; 
                } else {
                     console.error("[ERROR] competency-type-management-container not found in DOM for Manage Types click.");
                }
            } else {
                console.error("[ERROR] Could not find category to manage types for ID:", categoryId);
                if (typeManagementContainerGlobal) typeManagementContainerGlobal.style.display = 'none';
            }
        });
    });
}

// In DOMContentLoaded listener:
// loadDepartments();
// loadCompetencyCategories(); // ADD THIS LINE

// Inserting renderCompetencyTypeManagement function definition.
// This function should be placed before renderCompetencyCategoryManagement or where it can be globally accessed by its caller.

function renderCompetencyTypeManagement(container, category, editTypeData = null) {
    // ADD THESE LOGS START
    console.log("[DEBUG] renderCompetencyTypeManagement - Entry. Category ID:", category ? category.id : 'undefined', "Category Name:", category ? category.name : 'undefined');
    if (category && category.types) {
        console.log("[DEBUG] renderCompetencyTypeManagement - Received Category.types:", JSON.parse(JSON.stringify(category.types)));
    } else if (category) {
        console.log("[DEBUG] renderCompetencyTypeManagement - Received Category BUT category.types is missing or not an array. Category object:", JSON.parse(JSON.stringify(category)));
    } else {
        console.log("[DEBUG] renderCompetencyTypeManagement - Category object itself is undefined.");
    }
    // ADD THESE LOGS END

    console.log(`[renderCompetencyTypeManagement] For category: "${category ? category.name : 'INVALID CATEGORY'}", Edit Type:`, editTypeData); // Modified existing log for safety
    if (!container) { console.error("[renderCompetencyTypeManagement] Container not found."); return; }
    
    if (!category || !Array.isArray(category.types)) { 
        console.warn("[renderCompetencyTypeManagement] Category.types was not an array or category invalid. Initializing if category exists. Category:", category);
        if(category) category.types = []; 
        else { 
            container.innerHTML = '<p>Error: Invalid category data provided to renderCompetencyTypeManagement.</p>';
            return;
        }
    }
    // ... rest of the function remains the same

    const isEditingType = editTypeData !== null;
    const editingTypeId = isEditingType ? editTypeData.id : null;
    const currentTypeName = isEditingType ? editTypeData.name : '';
    const currentTypeDescription = isEditingType ? (editTypeData.description || '') : '';
    const currentTypeLevelScale = isEditingType ? (editTypeData.levelScale || 7) : 7; 
    const currentTypeLevelDescriptions = isEditingType ? (editTypeData.levelDescriptions || []) : [];
    const currentTypeDepts = isEditingType ? (editTypeData.taggedDepartments || []) : [];
    const currentTypeRoles = isEditingType ? (editTypeData.taggedRoleNames || []) : [];

    let formHTML = `<h4>Manage Competency Types for Category: <span style="color:#007bff;">${category.name}</span></h4>
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; background-color: #f0f0f0; border-radius: 4px;">
            <h5>${isEditingType ? 'Edit Competency Type' : 'Add New Competency Type'}</h5>
            <input type="hidden" id="type-id-for-edit" value="${editingTypeId || ''}">
        <div class="kpi-form-field">
                <label for="competency-type-name">Name:</label>
                <input type="text" id="competency-type-name" value="${currentTypeName}" placeholder="E.g., Demand Planning">
        </div>
        <div class="kpi-form-field">
                <label for="competency-type-description">Description (Optional):</label>
                <textarea id="competency-type-description" rows="2" placeholder="Details about this competency...">${currentTypeDescription}</textarea>
        </div>
            <div class="kpi-form-field">
                <label for="competency-type-level-scale">Max Level (1-X):</label>
                <input type="number" id="competency-type-level-scale" value="${currentTypeLevelScale}" min="1" max="20" step="1">
            </div>
            <!-- Container for dynamic level description fields -->
            <div id="competency-level-descriptions-container" style="margin-top:10px;">
                <!-- Level description fields will be rendered here by JavaScript -->
            </div>
            <!-- Department and Role Tagging (remains the same) -->
            <div class="kpi-form-field" style="margin-top:10px;">
                <label style="display:block; margin-bottom:3px;">Tag to Departments (Optional):</label>
                <div id="type-dept-tags" style="max-height:100px; overflow-y:auto; border:1px solid #ddd; padding:5px; background:#fff;">
                    ${configurableDepartments.length > 0 ? configurableDepartments.map(dept => `
                        <div><input type="checkbox" name="typeDepartmentTag" value="${dept.name}" ${currentTypeDepts.includes(dept.name) ? 'checked' : ''} id="type-dept-tag-${dept.id}-${category.id}"> 
                        <label for="type-dept-tag-${dept.id}-${category.id}">${dept.name}</label></div>
                    `).join('') : '<small>No departments configured.</small>'}
                </div>
            </div>
            <div class="kpi-form-field" style="margin-top:10px;">
                <label style="display:block; margin-bottom:3px;">Tag to Roles (Optional):</label>
                <div id="type-role-tags" style="max-height:100px; overflow-y:auto; border:1px solid #ddd; padding:5px; background:#fff;">
                    ${currentKpiData.length > 0 ? currentKpiData.map(role => `
                        <div><input type="checkbox" name="typeRoleTag" value="${role.roleName}" ${currentTypeRoles.includes(role.roleName) ? 'checked' : ''} id="type-role-tag-${role.roleName.replace(/\s+/g, '-')}-${category.id}"> 
                        <label for="type-role-tag-${role.roleName.replace(/\s+/g, '-')}-${category.id}">${role.roleName}</label></div>
                    `).join('') : '<small>No roles configured.</small>'}
                </div>
            </div>
            <button id="save-competency-type-button" class="setting-button" style="margin-top:15px;">${isEditingType ? 'Save Type Changes' : 'Add Competency Type'}</button>
            ${isEditingType ? '<button id="cancel-edit-type-button" type="button" class="setting-button-secondary" style="margin-left:10px;">Cancel Edit</button>' : ''}
        </div>
        <h5>Existing Types in "${category.name}"</h5>
        <ul style="list-style:none; padding:0;">`;
        // ... (HTML for listing existing types - needs to show level scale, but not individual descriptions in the list summary) ...
        if (!category.types || category.types.length === 0) {
            formHTML += '<p>No competency types defined for this category yet.</p>';
        } else {
            category.types.forEach(type => {
                if (!(isEditingType && type.id === editingTypeId)) {
                    let tagsDisplay = [];
                    if(type.taggedDepartments && type.taggedDepartments.length > 0) tagsDisplay.push(`Depts: ${type.taggedDepartments.join(', ')}`);
                    if(type.taggedRoleNames && type.taggedRoleNames.length > 0) tagsDisplay.push(`Roles: ${type.taggedRoleNames.join(', ')}`);
                    const tagsString = tagsDisplay.length > 0 ? ` <small style="color:#555;">(${tagsDisplay.join('; ')})</small>` : '';
                    const levelScaleDisplay = type.levelScale || 'N/A'; // Get level scale for display
    
                    formHTML += `<li style="padding:8px; margin-bottom:5px; background-color:#fff; border:1px solid #e9e9e9; border-radius:3px;">
                                    <strong>${type.name}</strong> (Max Lvl: ${levelScaleDisplay})${tagsString}<br>
                                    <small style="color:#666;">${type.description || 'No description.'}</small>
                                    <div style="margin-top:5px;">
                                        <button class="edit-competency-type-button setting-button-small" data-type-id="${type.id}">Edit</button>
                                        <button class="delete-competency-type-button setting-button-small danger" data-type-id="${type.id}" style="margin-left:5px;">Delete</button>
                                    </div>
                                 </li>`;
                }
            });
        }
        formHTML += `</ul>`;
    container.innerHTML = formHTML;

    // Initial rendering of level description fields
    renderLevelDescriptionInputs('competency-level-descriptions-container', currentTypeLevelScale, currentTypeLevelDescriptions);

    // Event listener for Max Level input change
    const levelScaleInput = document.getElementById('competency-type-level-scale');
    if (levelScaleInput) {
        levelScaleInput.addEventListener('input', (event) => {
            const newScale = parseInt(event.target.value) || 0;
            // When scale changes, we re-render, trying to preserve existing descriptions if any
            // For simplicity now, just re-render. A more complex solution would try to map old to new.
            const existingDescsToCarryOver = []; 
            for(let i=1; i<=newScale; i++){
                const oldDescInput = document.getElementById(`level-desc-${i}`);
                if(oldDescInput) existingDescsToCarryOver.push(oldDescInput.value);
                else existingDescsToCarryOver.push(''); // Push empty if no old input for that level
            }
            renderLevelDescriptionInputs('competency-level-descriptions-container', newScale, existingDescsToCarryOver);
        });
    }

    // Save button listener will be updated in the next step to collect these descriptions
    // For now, the save logic from previous step for name, desc, tags remains.
    // ... (Existing save, cancel, edit type, delete type listeners from previous implementation)
    const saveTypeButton = document.getElementById('save-competency-type-button');
    if (saveTypeButton) { 
        saveTypeButton.addEventListener('click', async () => { // MADE ASYNC
            // ... (Get typeName, typeDescription, typeLevelScale, selectedDeptTags, selectedRoleTags as before) ...
            const typeName = document.getElementById('competency-type-name').value.trim();
            const typeDescription = document.getElementById('competency-type-description').value.trim();
            const typeLevelScale = parseInt(document.getElementById('competency-type-level-scale').value) || 7;
            const selectedDeptTags = Array.from(document.querySelectorAll('#type-dept-tags input[name="typeDepartmentTag"]:checked')).map(cb => cb.value);
            const selectedRoleTags = Array.from(document.querySelectorAll('#type-role-tags input[name="typeRoleTag"]:checked')).map(cb => cb.value);
            
            // NEW: Collect level descriptions
            const collectedLevelDescriptions = [];
            for (let i = 1; i <= typeLevelScale; i++) {
                const descInput = document.getElementById(`level-desc-${i}`);
                collectedLevelDescriptions.push(descInput ? descInput.value.trim() : '');
            }

            if (!typeName) { alert('Competency Type name cannot be empty.'); return; }

            const typeData = {
                id: isEditingType ? editingTypeId : 'type_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                name: typeName,
                description: typeDescription,
                levelScale: typeLevelScale,
                levelDescriptions: collectedLevelDescriptions, // ADDED
                taggedDepartments: selectedDeptTags,
                taggedRoleNames: selectedRoleTags
            };
            // ... (rest of save logic: find catIndex, update/add type, persist, re-render)
            const catIndex = configurableCompetencyCategories.findIndex(c => c.id === category.id);
            if (catIndex === -1) { alert("Error: Parent category not found!"); return;}
             if (!Array.isArray(configurableCompetencyCategories[catIndex].types)) { 
                configurableCompetencyCategories[catIndex].types = [];
            }
            if (isEditingType) {
                const typeIndex = configurableCompetencyCategories[catIndex].types.findIndex(t => t.id === editingTypeId);
                if (typeIndex === -1) { alert("Error: Competency type to update not found."); renderCompetencyTypeManagement(container, category); return; }
                if (typeName.toLowerCase() !== configurableCompetencyCategories[catIndex].types[typeIndex].name.toLowerCase() &&
                    configurableCompetencyCategories[catIndex].types.some(t => t.id !== editingTypeId && t.name.toLowerCase() === typeName.toLowerCase())){
                    alert(`A competency type named "${typeName}" already exists in this category.`); return;
                }
                configurableCompetencyCategories[catIndex].types[typeIndex] = typeData;
                alert('Competency type updated!');
        } else {
                if (configurableCompetencyCategories[catIndex].types.some(t => t.name.toLowerCase() === typeName.toLowerCase())){
                    alert(`A competency type named "${typeName}" already exists in this category.`); return;
                }
                configurableCompetencyCategories[catIndex].types.push(typeData);
                alert('Competency type added!');
            }
            // persistCompetencyCategories(); // This is the OLD localStorage Call to be removed/replaced
            await persistCollection('competencyCategories', configurableCompetencyCategories); // NEW Firestore Call
            renderCompetencyTypeManagement(container, configurableCompetencyCategories[catIndex]); 
            const categoryManagementContainer = document.getElementById('competency-category-management-container');
            if (categoryManagementContainer) renderCompetencyCategoryManagement(categoryManagementContainer);
        });
    }
    if (isEditingType) {
        const cancelEditTypeButton = document.getElementById('cancel-edit-type-button');
        if(cancelEditTypeButton){ 
            cancelEditTypeButton.addEventListener('click', () => {
                renderCompetencyTypeManagement(container, category); 
            });
        }
    }
    container.querySelectorAll('.edit-competency-type-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const typeIdToEdit = event.target.dataset.typeId;
            const typeToEdit = category.types.find(t => t.id === typeIdToEdit);
            if (typeToEdit) renderCompetencyTypeManagement(container, category, typeToEdit);
        });
    });
    container.querySelectorAll('.delete-competency-type-button').forEach(button => {
        button.addEventListener('click', async (event) => { // MADE ASYNC
            const typeIdToDelete = event.target.dataset.typeId;
            const typeNameToDelete = category.types.find(t=>t.id === typeIdToDelete)?.name || 'this type';
            if (confirm(`Are you sure you want to delete the competency type "${typeNameToDelete}"?`)) {
                const catIndex = configurableCompetencyCategories.findIndex(c => c.id === category.id);
                if (catIndex !== -1) {
                    configurableCompetencyCategories[catIndex].types = configurableCompetencyCategories[catIndex].types.filter(t => t.id !== typeIdToDelete);
                    // persistCompetencyCategories(); // OLD localStorage Call
                    await persistCollection('competencyCategories', configurableCompetencyCategories); // NEW Firestore Call
                    renderCompetencyTypeManagement(container, configurableCompetencyCategories[catIndex]);
                    const categoryManagementContainer = document.getElementById('competency-category-management-container');
                    if (categoryManagementContainer) renderCompetencyCategoryManagement(categoryManagementContainer);
                }
            }
        });
    });
}

// Ensure other necessary functions (loadCompetencyCategories, persistCompetencyCategories, renderCompetencySetupPage, renderCompetencyCategoryManagement) are also present and correctly defined in the script.
// Also, ensure the DOMContentLoaded listener calls loadCompetencyCategories, and renderSettings/displaySettingInputs are updated for 'competencySetup' routing.

// Helper function to render level description fields

// Placeholder for the new rendering function

// Add more detailed logging at the start of displayEmployeeCompetencyAssessmentUI
function displayEmployeeCompetencyReport() {
    console.log("[displayEmployeeCompetencyReport] Called.");
    const displayArea = document.getElementById('report-display-area');
    if (!displayArea) { console.error("Competency report display area not found."); return; }

    const deptFilterElement = document.getElementById('competency-report-department-select');
    const roleFilterElement = document.getElementById('competency-report-role-select');

    const deptFilter = deptFilterElement ? deptFilterElement.value : "";
    const roleFilter = roleFilterElement ? roleFilterElement.value : "";
    
    console.log(`[displayEmployeeCompetencyReport] Filters - Dept: '${deptFilter}', Role: '${roleFilter}'`);

    let filteredEmpData = [...employeeData]; 
    if (deptFilter) {
        filteredEmpData = filteredEmpData.filter(emp => emp.department === deptFilter);
    }
    if (roleFilter) {
        filteredEmpData = filteredEmpData.filter(emp => emp.role === roleFilter);
    }
    
    const employeesWithAssessments = filteredEmpData.filter(emp => emp.assessedCompetencies && emp.assessedCompetencies.length > 0);

    if (employeesWithAssessments.length === 0) {
        displayArea.innerHTML = '<p style="padding:15px; background-color:#f0f0f0;">No employees with assessed competencies match the selected filters. Please adjust filters or assess competencies.</p>';
        return;
    }

    const categoriesMap = new Map(configurableCompetencyCategories.map(cat => [cat.id, cat.name]));
    const typesMap = new Map();
    configurableCompetencyCategories.forEach(cat => {
        (cat.types || []).forEach(type => {
            typesMap.set(type.id, { 
                name: type.name, 
                levelScale: type.levelScale || 7, 
                description: type.description || 'N/A', 
                levelDescriptions: type.levelDescriptions || [] 
            });
        });
    });

    let reportHTML = `<h3 style="margin-bottom:15px;">Employee Competency Report</h3>`;
    reportHTML += '<div class="competency-report-cards-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">';

    employeesWithAssessments.forEach(emp => {
        reportHTML += `<div class="employee-competency-card" style="border:1px solid #ddd; padding:15px; border-radius:5px; background-color:#f9f9f9;">
                        <h4 style="margin-top:0; margin-bottom:5px; color:#0056b3;">${emp.name} (ID: ${emp.id})</h4>
                        <p style="font-size:0.9em; margin-bottom:2px;"><strong>Role:</strong> ${emp.role || 'N/A'}</p>
                        <p style="font-size:0.9em; margin-bottom:10px;"><strong>Department:</strong> ${emp.department || 'N/A'}</p>
                        <h5 style="margin-bottom:5px; font-size:1em; color:#333;">Assessed Competencies:</h5>`;
        if (emp.assessedCompetencies.length > 0) {
            reportHTML += '<ul style="list-style-type: none; padding-left: 15px; margin-top:5px; font-size:0.85em;">';
            emp.assessedCompetencies.forEach(ac => {
                const categoryName = categoriesMap.get(ac.categoryId) || 'Unknown Category';
                const typeDetails = typesMap.get(ac.competencyTypeId) || { name: 'Unknown Type', levelScale: 7, description: 'N/A', levelDescriptions: [] };
                const levelDescription = (Array.isArray(typeDetails.levelDescriptions) && ac.assessedLevel && typeDetails.levelDescriptions[ac.assessedLevel -1]) 
                                      ? (typeDetails.levelDescriptions[ac.assessedLevel -1] || 'N/A') 
                                      : 'N/A';
                reportHTML += `<li style="margin-bottom:10px; padding-bottom:8px; border-bottom: 1px dotted #eee;">
                                <strong>${typeDetails.name}</strong> (<em>${categoryName}</em>)<br>
                                Level: <strong>${ac.assessedLevel} / ${typeDetails.levelScale}</strong> <br>
                                <em style="font-size:0.9em; color:#555;">Def: ${levelDescription}</em><br>
                                ${ac.evidence ? `Evidence: <span style="font-style:italic; color:#555; display:block; max-height: 40px; overflow:hidden; text-overflow:ellipsis; white-space:normal;">${ac.evidence.replace(/\n/g, '<br>')}</span>` : ''}
                              </li>`;
            });
            reportHTML += '</ul>';
        } else {
            reportHTML += '<p style="font-style:italic; font-size:0.9em;">No competencies assessed for this employee.</p>';
        }
        reportHTML += `</div>`; 
    });
    reportHTML += '</div>'; 

    // Add Download/Print buttons if there's data
    if (employeesWithAssessments.length > 0) {
        reportHTML += `
            <div id="report-actions-competency" class="report-actions-container" style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #ccc;">
                <button id="download-csv-competency" class="report-action-button">Download CSV</button>
                <button id="download-excel-competency" class="report-action-button" style="margin-left: 10px;">Download Excel (as CSV)</button>
                <button id="print-report-competency" class="report-action-button" style="margin-left: 10px;">Print Report</button>
            </div>
        `;
    }

    displayArea.innerHTML = reportHTML;
    console.log("[displayEmployeeCompetencyReport] Report HTML rendered, including action buttons if any.");

    // Attach event listeners for the new action buttons
    const downloadCSVCompBtn = document.getElementById('download-csv-competency');
    if (downloadCSVCompBtn) {
        downloadCSVCompBtn.addEventListener('click', () => {
            const filename = `Employee_Competency_Report_${deptFilter || 'AllDepts'}_${roleFilter || 'AllRoles'}.csv`;
            const csvData = generateEmployeeCompetencyReportCSV(employeesWithAssessments); 
            if (csvData) {
                triggerCSVDownload(csvData, filename);
            } else {
                alert('No data available to download for the current selection.');
            }
        });
    }
    const downloadExcelCompBtn = document.getElementById('download-excel-competency');
    if (downloadExcelCompBtn) {
        downloadExcelCompBtn.addEventListener('click', () => {
            const filename = `Employee_Competency_Report_${deptFilter || 'AllDepts'}_${roleFilter || 'AllRoles'}.csv`;
            const csvData = generateEmployeeCompetencyReportCSV(employeesWithAssessments);
            if (csvData) {
                triggerCSVDownload(csvData, filename);
            } else {
                alert('No data available to download for the current selection.');
            }
        });
    }
    const printReportCompBtn = document.getElementById('print-report-competency');
    if (printReportCompBtn) {
        printReportCompBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

// Ensure this is defined, as it's called by renderSingleCompetencyAssessmentFields
// and renderEmployeeAssessedCompetenciesList
async function persistEmployeeData() { // This function will now save the entire employeeData array to Firestore
    try {
        for (const emp of employeeData) {
            if (!emp.id) { // This case should ideally be handled by addEmployee for new employees
                console.error("Trying to persist employee without an ID:", emp);
                // Potentially generate an ID here or skip, depending on your logic
                // For now, we'll assume new employees are added via addEmployee
                continue; 
            }
            // Use emp.id as the document ID in Firestore
            await setDoc(doc(db, "employees", emp.id), emp);
        }
        console.log('Employee data persisted to Firestore.');
    } catch (error) {
        console.error('Error saving employee data to Firestore:', error);
    }
}

// Helper function to render level description fields (used by renderSingleCompetencyAssessmentFields)
function renderLevelDescriptionInputs(containerId, scale, descriptions = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; // Clear previous fields
    if (scale > 0 && scale <= 20) { // Max 20 levels for sanity
        for (let i = 1; i <= scale; i++) {
            const desc = descriptions[i - 1] || ''; // Get existing description or empty string
            container.innerHTML += `
                <div class="kpi-form-field" style="margin-left:15px; margin-bottom:5px;">
                    <label for="level-desc-${i}" style="display:block; font-weight:normal; margin-bottom:2px;">Description for Level ${i}:</label>
                    <textarea id="level-desc-${i}" rows="2" style="width: calc(100% - 22px); padding: 5px; border:1px solid #ccc; border-radius:3px;" placeholder="Define what Level ${i} means...">${desc}</textarea>
                </div>
            `;
        }
    }
}

/**
 * Bulk-upserts an array of { id, ...data } into Firestore.
 * @param {string} colName  Collection name
 * @param {Array<{id:string, ...}>} items  Array of objects with .id + fields
 */
async function persistCollection(colName, items) {
    const batch = writeBatch(db);
    const colRef = collection(db, colName);
  
    items.forEach(item => {
      if (!item.id) return;       // skip objects without an id
      const docRef = doc(colRef, item.id);
      batch.set(docRef, item);
    });
  
    await batch.commit();
    console.log(`persistCollection: synced ${items.length} documents to '${colName}'.`);
  }


// Function to render the list of assessed competencies for an employee


// Function to render fields for assessing a SINGLE competency type

// Main function to display the entire competency assessment UI for an employee
function displayEmployeeCompetencyAssessmentUI(assessmentAreaContainer, employeeId) {
    console.log(`[displayEmployeeCompetencyAssessmentUI] Called for employee ID: ${employeeId}`);
    if (!assessmentAreaContainer) {
        console.error("[displayEmployeeCompetencyAssessmentUI] Assessment area container NOT FOUND.");
        return;
    }
    assessmentAreaContainer.innerHTML = ''; // Clear previous content

    const employee = employeeData.find(emp => emp.id === employeeId);
    if (!employee) {
        assessmentAreaContainer.innerHTML = '<p style="color:red;">Error: Employee details not found.</p>';
        return;
    }
    if (!Array.isArray(employee.assessedCompetencies)) {
        employee.assessedCompetencies = [];
    }

    // 1. Container for displaying currently assessed competencies LIST
    let listAndFormHTML = `<div id="current-employee-competencies-list-container" style="margin-bottom: 30px;">
                               <!-- List will be rendered here by renderEmployeeAssessedCompetenciesList -->
                           </div>`;
    
    // 2. Assessment Form Area (remains for adding new/editing - by delete then re-add)
    listAndFormHTML += `<div id="competency-assessment-form-area" style="margin-top:20px; border-top: 2px solid #007bff; padding-top:20px;">
                          <h3 style="margin-top:0; color:#007bff;">Assess New or Update Competency:</h3>
                          <p style="font-size:0.9em; color:#555; margin-bottom:15px;">To update an existing assessment, please delete it from the list above and then add the new assessment using the form below.</p>
                          <div style="margin-bottom:15px;">
                              <label for="assessment-category-select" style="font-weight:bold; margin-right:5px;">1. Select Competency Category:</label>
                              <select id="assessment-category-select" style="padding:5px; min-width:250px;">
                                  <option value="">-- Select Category --</option>`;
    configurableCompetencyCategories.forEach(cat => {
        listAndFormHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
    listAndFormHTML += `       </select>
                          </div>
                          <div id="assessment-type-select-container" style="margin-bottom:15px; display:none;">
                              <!-- Type selector will be populated here -->
                          </div>
                          <div id="assessment-fields-container" style="min-height: 50px;">
                              <!-- Assessment fields for selected type will go here. Initial message set by category change. -->
                          </div>
                      </div>`;
    assessmentAreaContainer.innerHTML = listAndFormHTML; 

    const assessedListDiv = document.getElementById('current-employee-competencies-list-container');
    if (assessedListDiv) {
        renderEmployeeAssessedCompetenciesList(employee, assessedListDiv);
    } else {
        console.error("[displayEmployeeCompetencyAssessmentUI] Failed to find current-employee-competencies-list-container.");
    }

    const categorySelect = document.getElementById('assessment-category-select');
    const typeSelectContainer = document.getElementById('assessment-type-select-container');
    const fieldsContainer = document.getElementById('assessment-fields-container');
    
    if (categorySelect && typeSelectContainer && fieldsContainer) {
        categorySelect.addEventListener('change', (event) => {
            const selectedCategoryId = event.target.value;
            typeSelectContainer.innerHTML = ''; 
            fieldsContainer.innerHTML = '';   
            typeSelectContainer.style.display = 'none';
            if (!selectedCategoryId) {
                fieldsContainer.innerHTML = '<p style="padding:10px; background-color:#f0f0f0;">Select a category to see available competency types.</p>';
                return;
            }

            const selectedCategory = configurableCompetencyCategories.find(cat => cat.id === selectedCategoryId);
            if (selectedCategory && selectedCategory.types) {
                const relevantTypes = selectedCategory.types.filter(type => {
                    const isGlobal = (!type.taggedDepartments || type.taggedDepartments.length === 0) && 
                                        (!type.taggedRoleNames || type.taggedRoleNames.length === 0);
                    const matchesDept = type.taggedDepartments && type.taggedDepartments.includes(employee.department);
                    const matchesRole = type.taggedRoleNames && type.taggedRoleNames.includes(employee.role);
                    return isGlobal || matchesDept || matchesRole;
                });

                if (relevantTypes.length > 0) {
                    let typeSelectorHTML = `<label for="assessment-type-select" style="font-weight:bold; margin-right:5px;">2. Select Competency Type:</label>
                                            <select id="assessment-type-select" style="padding:5px; min-width:250px;">
                                                <option value="">-- Select Type --</option>`;
                    relevantTypes.forEach(type => {
                        typeSelectorHTML += `<option value="${type.id}">${type.name}</option>`;
                    });
                    typeSelectorHTML += '</select>';
                    typeSelectContainer.innerHTML = typeSelectorHTML;
                    typeSelectContainer.style.display = 'block';
                    fieldsContainer.innerHTML = '<p style="padding:10px; background-color:#f0f0f0;">Select a competency type to assess.</p>';

                    const typeSelect = document.getElementById('assessment-type-select');
                    if (typeSelect) {
                        typeSelect.addEventListener('change', (e_type) => {
                            const selectedTypeId = e_type.target.value;
                            fieldsContainer.innerHTML = '';
                            if (selectedTypeId) {
                                const selectedTypeObject = selectedCategory.types.find(t => t.id === selectedTypeId);
                                if (selectedTypeObject) {
                                    renderSingleCompetencyAssessmentFields(fieldsContainer, employee, selectedCategory, selectedTypeObject);
                                }
                            } else {
                                    fieldsContainer.innerHTML = '<p style="padding:10px; background-color:#f0f0f0;">Select a competency type to assess.</p>';
                            }
                        });
                    }
                } else {
                    typeSelectContainer.innerHTML = '<p style="font-style:italic; color:#555;">No competency types relevant to this employee found in the selected category for assessment.</p>';
                    typeSelectContainer.style.display = 'block';
                    fieldsContainer.innerHTML = '';
                }
            }
        });
        if (!categorySelect.value && fieldsContainer) {
             fieldsContainer.innerHTML = '<p style="padding:10px; background-color:#f0f0f0;">Select a category above to begin assessing a new competency.</p>';
        }
    } else {
        console.error("[displayEmployeeCompetencyAssessmentUI] Critical form selectors not found.");
    }
}

// Ensure renderCompetenciesSection calls displayEmployeeCompetencyAssessmentUI correctly
function renderCompetenciesSection() {
    console.log("[renderCompetenciesSection] Called. Initializing Employee Competencies page...");
    const contentWrapper = document.getElementById('competency-assessment-content-wrapper');
    if (!contentWrapper) {
        console.error("[renderCompetenciesSection] competency-assessment-content-wrapper not found!");
        return;
    }

    let selectorHTML = '<div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">';
    selectorHTML += '<label for="competency-employee-select" style="margin-right: 10px; font-weight: bold;">Select Employee:</label>';
    selectorHTML += '<select id="competency-employee-select" style="padding: 5px; min-width: 250px;">';
    selectorHTML += '<option value="">-- Select an Employee --</option>';
    if (employeeData && employeeData.length > 0) {
        employeeData.forEach(emp => {
            selectorHTML += `<option value="${emp.id}">${emp.name} (ID: ${emp.id})</option>`;
        });
    } else {
        selectorHTML += '<option value="" disabled>No employees found. Please add employees first.</option>';
    }
    selectorHTML += '</select></div>';
    selectorHTML += '<div id="employee-specific-competency-assessment-area"></div>'; 
    contentWrapper.innerHTML = selectorHTML;

    const employeeSelectForCompetency = document.getElementById('competency-employee-select');
    const assessmentArea = document.getElementById('employee-specific-competency-assessment-area');

    if (employeeSelectForCompetency && assessmentArea) {
        employeeSelectForCompetency.addEventListener('change', (event) => {
            const selectedEmployeeId = event.target.value;
            if (selectedEmployeeId) {
                console.log(`[renderCompetenciesSection] Employee selected: ${selectedEmployeeId}. Calling displayEmployeeCompetencyAssessmentUI.`);
                displayEmployeeCompetencyAssessmentUI(assessmentArea, selectedEmployeeId); // Ensure this call is correct
            } else {
                assessmentArea.innerHTML = '<p style="padding:10px; background-color:#f0f0f0;">Please select an employee from the dropdown above.</p>';
            }
        });
    }
    if(assessmentArea && (!employeeSelectForCompetency || !employeeSelectForCompetency.value)){
        assessmentArea.innerHTML = '<p style="padding:10px; background-color:#f0f0f0;">Please select an employee from the dropdown above to view or assess their competencies.</p>';
    }
}

// Comment out or remove renderCompetencyOrbsDisplay and renderCompetencyRadarChart
/*

*/

// This should be the current version of renderEmployeeAssessedCompetenciesList
function renderEmployeeAssessedCompetenciesList(employee, listContainer) {
    console.log(`[renderEmployeeAssessedCompetenciesList] For employee: ${employee.name}`);
    if (!listContainer) { console.error("[renderEmployeeAssessedCompetenciesList] List container not found."); return; }
    
    let listHTML = `<h4 style="border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:10px;">Current Assessed Competencies for ${employee.name}</h4>`;

    const categoriesMap = new Map(configurableCompetencyCategories.map(cat => [cat.id, cat]));
    const typesMap = new Map();
    configurableCompetencyCategories.forEach(cat => {
        (cat.types || []).forEach(type => {
            typesMap.set(type.id, {...type, categoryName: cat.name });
        });
    });

    if (!employee.assessedCompetencies || employee.assessedCompetencies.length === 0) {
        listHTML += '<p style="font-style:italic; color:#777;">No competencies have been assessed for this employee yet.</p>';
        listContainer.innerHTML = listHTML;
        return;
    }

    listHTML += '<ul style="list-style:none; padding:0;">';
    employee.assessedCompetencies.forEach((assessedComp, index) => {
        const competencyType = typesMap.get(assessedComp.competencyTypeId);
        const categoryName = competencyType ? competencyType.categoryName : (categoriesMap.get(assessedComp.categoryId) ? categoriesMap.get(assessedComp.categoryId).name : 'Unknown Category');
        const typeName = competencyType ? competencyType.name : 'Unknown Competency Type';
        const levelScale = competencyType ? (competencyType.levelScale || 7) : 7;
        const levelDescription = (competencyType && Array.isArray(competencyType.levelDescriptions) && assessedComp.assessedLevel && competencyType.levelDescriptions[assessedComp.assessedLevel -1]) 
                                ? (competencyType.levelDescriptions[assessedComp.assessedLevel -1] || 'N/A') 
                                : 'N/A';

        listHTML += `<li style="padding:12px; margin-bottom:10px; background-color:#fdfdfd; border:1px solid #e0e0e0; border-radius:4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                            <strong style="font-size:1.1em; color:#2c3e50;">${typeName}</strong>
                            <button class="delete-assessed-competency-button setting-button-small danger" data-assessment-index="${index}" title="Delete this assessment">Delete</button>
                        </div>
                        <p style="font-size:0.9em; margin:2px 0;"><strong>Category:</strong> ${categoryName}</p>
                        <p style="font-size:0.9em; margin:2px 0;"><strong>Assessed Level:</strong> <span style="font-weight:bold; color: #007bff;">${assessedComp.assessedLevel} / ${levelScale}</span></p>
                        <p style="font-size:0.85em; margin:2px 0; color:#555;"><em>Level Definition: ${levelDescription}</em></p>
                        ${assessedComp.evidence ? `<p style="font-size:0.9em; margin:5px 0;"><strong>Evidence/Comments:</strong><br><span style="white-space: pre-wrap;">${assessedComp.evidence.replace(/\n/g, '<br>')}</span></p>` : ''}
                        <p style="color:#777; font-size:0.8em; margin-top:8px; text-align:right;">Assessed on: ${new Date(assessedComp.assessmentDate).toLocaleDateString()}</p>
                     </li>`;
    });
    listHTML += '</ul>';
    listContainer.innerHTML = listHTML;

    listContainer.querySelectorAll('.delete-assessed-competency-button').forEach(button => {
        button.addEventListener('click', (event) => {
            console.log("[DEBUG] Delete assessed competency button CLICKED.");
            const assessmentIndexStr = event.target.dataset.assessmentIndex;
            console.log("[DEBUG] assessmentIndex from dataset:", assessmentIndexStr);
            const assessmentIndex = parseInt(assessmentIndexStr);
            if (isNaN(assessmentIndex)) {
                console.error("[ERROR] Invalid assessmentIndex:", assessmentIndexStr);
                alert("Error: Could not determine which assessment to delete.");
                return;
            }
            const competencyToDisplay = employee.assessedCompetencies[assessmentIndex]; 
            let competencyNameForConfirm = 'this competency assessment';
            if(competencyToDisplay){
                const typeInfo = typesMap.get(competencyToDisplay.competencyTypeId);
                if(typeInfo) competencyNameForConfirm = typeInfo.name;
                console.log(`[DEBUG] Attempting to delete: '${competencyNameForConfirm}' at index ${assessmentIndex}`);
    } else {
                console.warn(`[DEBUG] Could not find competency in employee.assessedCompetencies at index: ${assessmentIndex} for confirmation message. Employee:`, employee.name);
            }
            if (confirm(`Are you sure you want to remove the assessment for "${competencyNameForConfirm}"?`)) {
                if (assessmentIndex >= 0 && assessmentIndex < employee.assessedCompetencies.length) {
                    console.log("[DEBUG] Splicing assessment at index:", assessmentIndex);
                    employee.assessedCompetencies.splice(assessmentIndex, 1);
                    persistEmployeeData();
                    console.log("[DEBUG] Data persisted. Re-rendering assessed competencies list.");
                    renderEmployeeAssessedCompetenciesList(employee, listContainer); 
                } else {
                    alert("Error: Could not delete assessment due to an invalid index after confirmation.");
                    console.error("[ERROR] Invalid index for splice:", assessmentIndex, "Assessments array:", employee.assessedCompetencies);
                    renderEmployeeAssessedCompetenciesList(employee, listContainer); 
                }
            }
        });
    });
}

// renderSingleCompetencyAssessmentFields needs its save button to call renderEmployeeAssessedCompetenciesList
// Make sure this is handled as described in previous steps if not already.

// Comment out or remove renderCompetencyOrbsDisplay and renderCompetencyRadarChart if no longer needed
/*
function renderCompetencyOrbsDisplay(employee, orbsDisplayContainer) { ... }
function renderCompetencyRadarChart(employee) { ... }
*/

// In script.js - PLACE THIS FUNCTION DEFINITION *BEFORE* displayEmployeeCompetencyAssessmentUI

function renderSingleCompetencyAssessmentFields(container, employee, category, type) {
    console.log(`[DEBUG] renderSingleCompetencyAssessmentFields: For Employee: ${employee.id}, Category: ${category.name}, Type: ${type.name}`);
    if (!container) {
        console.error("[DEBUG] renderSingleCompetencyAssessmentFields: Target container is null!");
        return;
    }
    const competencyTypeId = type.id;
    const existingAssessment = employee.assessedCompetencies.find(ac => ac.competencyTypeId === competencyTypeId);
    const currentAssessedLevel = existingAssessment ? existingAssessment.assessedLevel : '';
    const currentEvidence = existingAssessment ? (existingAssessment.evidence || '') : '';
    const levelScale = type.levelScale || 7;
    
    let fieldsHTML = `<div class="competency-type-assessment-item" data-competency-type-id="${competencyTypeId}" data-category-id="${category.id}" style="padding:15px; background-color:#f0f8ff; border:1px solid #add8e6; border-radius:4px;">
                        <h5 style="margin-top:0;">Assessing: ${type.name} <small style="font-weight:normal;">(Max Level: ${levelScale})</small></h5>
                        ${type.description ? `<p style="font-size:0.9em; color:#555; margin-top:0; margin-bottom:8px;">${type.description}</p>` : ''}
                        <div style="display:flex; align-items:center; margin-bottom:8px;">
                            <label for="level-select-${competencyTypeId}" style="margin-right:10px;">3. Assess Level:</label>
                            <select id="level-select-${competencyTypeId}" class="competency-level-select-single" data-type-id="${competencyTypeId}" data-category-id="${category.id}" style="padding:5px;">
                                <option value="">-- Select Level --</option>`;
    for (let i = 1; i <= levelScale; i++) {
        fieldsHTML += `<option value="${i}" ${currentAssessedLevel === i ? 'selected' : ''}>Level ${i}</option>`;
    }
    fieldsHTML += `       </select>
                            <div id="level-desc-display-${competencyTypeId}" style="margin-left:15px; font-size:0.85em; color:#444; font-style:italic; max-width:400px;">
                                ${currentAssessedLevel && Array.isArray(type.levelDescriptions) && type.levelDescriptions[currentAssessedLevel - 1] ? type.levelDescriptions[currentAssessedLevel - 1] : ''}
                            </div>
                        </div>
                        <div>
                            <label for="evidence-text-${competencyTypeId}" style="display:block; margin-bottom:3px;">4. Evidence/Comments:</label>
                            <textarea id="evidence-text-${competencyTypeId}" rows="3" style="width:98%; padding:5px; border:1px solid #ccc;" placeholder="Provide specific examples or comments...">${currentEvidence}</textarea>
                        </div>
                        <button id="save-single-competency-assessment-button" class="setting-button" style="margin-top:15px;" data-competency-type-id="${competencyTypeId}" data-category-id="${category.id}">Save This Competency Assessment</button>
                     </div>`;
    
    container.innerHTML = fieldsHTML;
    console.log(`[DEBUG] renderSingleCompetencyAssessmentFields: Rendered fields for type ${type.name}.`);

    const levelSelectElement = document.getElementById(`level-select-${competencyTypeId}`);
    if (levelSelectElement) { 
        levelSelectElement.addEventListener('change', (event) => {
            const selectedLevel = parseInt(event.target.value);
            const descDisplayDiv = document.getElementById(`level-desc-display-${competencyTypeId}`);
            const currentCategory = configurableCompetencyCategories.find(cat => cat.id === category.id); // Re-find, or pass type object directly
            const currentType = currentCategory ? currentCategory.types.find(t => t.id === type.id) : null;

            if (descDisplayDiv && currentType && Array.isArray(currentType.levelDescriptions)) {
                descDisplayDiv.textContent = selectedLevel && currentType.levelDescriptions[selectedLevel - 1] 
                                            ? currentType.levelDescriptions[selectedLevel - 1]
                                            : (selectedLevel ? `Level ${selectedLevel} - No description defined.` : '');
            } else if (descDisplayDiv) {
                descDisplayDiv.textContent = selectedLevel ? `Level ${selectedLevel}` : '';
            }
        });
    }

    const saveSingleButton = document.getElementById('save-single-competency-assessment-button');
    if (saveSingleButton) { 
        saveSingleButton.addEventListener('click', async (event) => { // MADE ASYNC
            const typeIdToSave = event.target.dataset.competencyTypeId;
            const categoryIdOfSavedType = event.target.dataset.categoryId; // Ensure this is correct
            const assessedLevelValue = parseInt(document.getElementById(`level-select-${typeIdToSave}`).value) || null;
            const evidenceText = document.getElementById(`evidence-text-${typeIdToSave}`).value.trim();

            if (assessedLevelValue === null) { 
                alert('Please select a level for the competency.');
                return; 
            }

            const assessmentEntry = {
                competencyTypeId: typeIdToSave,
                categoryId: categoryIdOfSavedType,
                assessedLevel: assessedLevelValue,
                evidence: evidenceText,
                assessmentDate: new Date().toISOString()
            };

            const existingAssessmentIndex = employee.assessedCompetencies.findIndex(ac => ac.competencyTypeId === typeIdToSave);
            if (existingAssessmentIndex > -1) {
                employee.assessedCompetencies[existingAssessmentIndex] = assessmentEntry;
            } else {
                employee.assessedCompetencies.push(assessmentEntry);
            }
            // persistEmployeeData(); // Replace this line
            await saveEmployee(employee); // With this line

            alert(`Assessment for competency type '${type.name}' saved successfully for ${employee.name}!`);
            
            
            const assessedListContainerUpdate = document.getElementById('current-employee-competencies-list-container');
            if (assessedListContainerUpdate) {
                 renderEmployeeAssessedCompetenciesList(employee, assessedListContainerUpdate);
            }
            container.innerHTML = `<p style="color:green; padding:10px;">Assessment for '${type.name}' saved. Select another category/type or re-select this one to update.</p>`;
        });
    }
}

