// frontend/script.js

const API_BASE_URL = 'http://127.0.0.1:8000';

let yieldChartInstance = null; // Still here, but effectively null for Google Charts

// --- Custom Modal Elements ---
const customModal = document.getElementById('customModal');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
// Query all close buttons, including the main confirmation modal's X
const allCloseButtons = document.querySelectorAll('.close-button');


let currentConfirmAction = null; // Stores the function to call on confirmation

// --- Helper function to display messages ---
function displayMessage(elementId, message, type = 'success') {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
        setTimeout(() => {
            messageElement.style.display = 'none';
            messageElement.textContent = '';
        }, 5000);
    }
}

// --- Custom Confirmation Modal ---
function showConfirmation(message, onConfirm) {
    modalMessage.textContent = message;
    customModal.style.display = 'flex'; // Use flex to center the modal
    currentConfirmAction = onConfirm;
}

function hideConfirmation() {
    customModal.style.display = 'none';
    currentConfirmAction = null;
}

// --- Edit/Update Modal Logic ---
function showEditModal(modalId, data = null) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex'; // Use flex to center the modal
        if (data) {
            populateEditForm(modalId, data);
        }
        // Always repopulate dropdowns just in case, before showing modal
        fetchCrops(true); // For crop-related dropdowns
        fetchInputsForDropdown(); // For input-related dropdowns
    }
}

function hideEditModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        // Reset message for the specific form within the modal
        const messageElement = modal.querySelector('.message');
        if (messageElement) {
            messageElement.textContent = '';
            messageElement.className = 'message';
        }
    }
}

function populateEditForm(modalId, data) {
    if (modalId === 'editCropModal') {
        document.getElementById('editCropId').value = data.crop_id || '';
        document.getElementById('editCropName').value = data.crop_name || '';
        document.getElementById('editPlantingSeason').value = data.planting_season || '';
        document.getElementById('editExpectedYield').value = data.expected_yield_per_acre || '';
    } else if (modalId === 'editYieldModal') {
        document.getElementById('editYieldId').value = data.yield_id || '';
        document.getElementById('editYieldCropId').value = data.crop_id || '';
        document.getElementById('editHarvestDate').value = data.harvest_date || '';
        document.getElementById('editActualYield').value = data.actual_yield || '';
        document.getElementById('editYieldUnit').value = data.unit || '';
        document.getElementById('editYieldLocation').value = data.field_location || '';
        document.getElementById('editYieldNotes').value = data.notes || '';
    } else if (modalId === 'editSoilModal') {
        document.getElementById('editSoilReadingId').value = data.reading_id || '';
        document.getElementById('editSoilCropId').value = data.crop_id || '';
        document.getElementById('editReadingDate').value = data.reading_date || '';
        document.getElementById('editSoilMoisture').value = data.soil_moisture_percentage || '';
        document.getElementById('editPhLevel').value = data.ph_level || '';
        document.getElementById('editNitrogenLevel').value = data.nitrogen_level_ppm || '';
        document.getElementById('editPhosphorusLevel').value = data.phosphorus_level_ppm || '';
        document.getElementById('editPotassiumLevel').value = data.potassium_level_ppm || '';
        document.getElementById('editSoilNotes').value = data.notes || '';
    } else if (modalId === 'editInputModal') {
        document.getElementById('editInputId').value = data.input_id || '';
        document.getElementById('editInputCropId').value = data.crop_id || '';
        document.getElementById('editUsageDate').value = data.usage_date || '';
        document.getElementById('editInputType').value = data.input_type || '';
        document.getElementById('editInputName').value = data.input_name || '';
        document.getElementById('editQuantityUsed').value = data.quantity_used || '';
        document.getElementById('editInputUnit').value = data.unit || '';
        document.getElementById('editInputLocation').value = data.field_location || '';
        document.getElementById('editInputNotes').value = data.notes || '';
    } else if (modalId === 'editInputCostModal') {
        document.getElementById('editCostId').value = data.cost_id || '';
        document.getElementById('editCostInputId').value = data.input_id || ''; // Populate linked input
        document.getElementById('editCostItemName').value = data.item_name || '';
        document.getElementById('editCostDate').value = data.cost_date || '';
        document.getElementById('editCostAmount').value = data.cost_amount || '';
        document.getElementById('editCostCurrency').value = data.currency || '';
        document.getElementById('editCostNotes').value = data.notes || '';
    }
}


// --- Functions to fetch and display data (modified to include Edit/Delete buttons) ---
async function fetchCrops(onlyDropdowns = false) {
    const cropsListDiv = document.getElementById('crops-list');
    const yieldCropIdSelect = document.getElementById('yieldCropId');
    const soilCropIdSelect = document.getElementById('soilCropId');
    const inputCropIdSelect = document.getElementById('inputCropId');
    const editYieldCropIdSelect = document.getElementById('editYieldCropId');
    const editSoilCropIdSelect = document.getElementById('editSoilCropId');
    const editInputCropIdSelect = document.getElementById('editInputCropId');

    if (!onlyDropdowns && !cropsListDiv) return;

    if (!onlyDropdowns) {
        cropsListDiv.innerHTML = '<p>Loading crops...</p>';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/crops/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const crops = await response.json();

        if (!onlyDropdowns) {
            cropsListDiv.innerHTML = '';
            if (crops.length === 0) {
                cropsListDiv.innerHTML = '<p>No crops found. Add some!</p>';
            } else {
                crops.forEach(crop => {
                    const cropCard = document.createElement('div');
                    cropCard.className = 'card';
                    cropCard.innerHTML = `
                        <h3>${crop.crop_name}</h3>
                        <p><strong>ID:</strong> ${crop.crop_id}</p>
                        <p><strong>Season:</strong> ${crop.planting_season || 'N/A'}</p>
                        <p><strong>Expected Yield:</strong> ${crop.expected_yield_per_acre ? `${crop.expected_yield_per_acre} units/acre` : 'N/A'}</p>
                        <div class="card-actions">
                            <button class="btn btn-icon edit-btn" data-id="${crop.crop_id}" data-type="crop"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-icon delete-btn" data-id="${crop.crop_id}" data-type="crop"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `;
                    cropsListDiv.appendChild(cropCard);
                });
                attachActionListeners(cropsListDiv);
            }
        }

        const allCropSelects = [
            yieldCropIdSelect, soilCropIdSelect, inputCropIdSelect,
            editYieldCropIdSelect, editSoilCropIdSelect, editInputCropIdSelect
        ];

        allCropSelects.forEach(selectElement => {
            if (selectElement) {
                const currentSelectedValue = selectElement.value;
                const defaultOptionText = selectElement.id.includes('Optional') ? 'Select a crop (Optional)' : 'Select a crop';
                selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
                crops.forEach(crop => {
                    const option = document.createElement('option');
                    option.value = crop.crop_id;
                    option.textContent = crop.crop_name;
                    selectElement.appendChild(option);
                });
                selectElement.value = currentSelectedValue;
            }
        });

    } catch (error) {
        console.error("Error fetching crops:", error);
        if (!onlyDropdowns) {
            if (cropsListDiv) cropsListDiv.innerHTML = `<p class="message error">Failed to load crops: ${error.message}. Please ensure the backend server is running.</p>`;
        }
        const allCropSelects = [
            yieldCropIdSelect, soilCropIdSelect, inputCropIdSelect,
            editYieldCropIdSelect, editSoilCropIdSelect, editInputCropIdSelect
        ];
        allCropSelects.forEach(selectElement => {
            if (selectElement) {
                selectElement.innerHTML = '<option value="">Failed to load crops</option>';
            }
        });
    }
}

async function fetchYields() {
    const yieldsListDiv = document.getElementById('yields-list');
    if (!yieldsListDiv) return;

    yieldsListDiv.innerHTML = '<p>Loading yield records...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/yields/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const yields = await response.json();

        yieldsListDiv.innerHTML = '';

        if (yields.length === 0) {
            yieldsListDiv.innerHTML = '<p>No yield records found. Add some!</p>';
        } else {
            yields.forEach(record => {
                const yieldCard = document.createElement('div');
                yieldCard.className = 'card';
                yieldCard.innerHTML = `
                    <h3>Yield ID: ${record.yield_id} - ${record.crop_name || 'N/A'}</h3>
                    <p><strong>Harvest Date:</strong> ${record.harvest_date}</p>
                    <p><strong>Actual Yield:</strong> ${record.actual_yield} ${record.unit}</p>
                    <p><strong>Location:</strong> ${record.field_location || 'N/A'}</p>
                    <p><strong>Notes:</strong> ${record.notes || 'N/A'}</p>
                    <div class="card-actions">
                        <button class="btn btn-icon edit-btn" data-id="${record.yield_id}" data-type="yield"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-icon delete-btn" data-id="${record.yield_id}" data-type="yield"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                yieldsListDiv.appendChild(yieldCard);
            });
            attachActionListeners(yieldsListDiv);
        }
    } catch (error) {
        console.error("Error fetching yields:", error);
        yieldsListDiv.innerHTML = `<p class="message error">Failed to load yield records: ${error.message}.</p>`;
    }
}

async function fetchSoilReadings() {
    const soilReadingsListDiv = document.getElementById('soil-readings-list');
    if (!soilReadingsListDiv) return;

    soilReadingsListDiv.innerHTML = '<p>Loading soil readings...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/soil_readings/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const readings = await response.json();

        soilReadingsListDiv.innerHTML = '';

        if (readings.length === 0) {
            soilReadingsListDiv.innerHTML = '<p>No soil readings found. Add some!</p>';
        } else {
            readings.forEach(record => {
                const readingCard = document.createElement('div');
                readingCard.className = 'card';
                readingCard.innerHTML = `
                    <h3>Reading ID: ${record.reading_id} - ${record.crop_name || 'General'}</h3>
                    <p><strong>Date:</strong> ${record.reading_date}</p>
                    <p><strong>Moisture:</strong> ${record.soil_moisture_percentage ? `${record.soil_moisture_percentage}%` : 'N/A'}</p>
                    <p><strong>pH:</strong> ${record.ph_level || 'N/A'}</p>
                    <p><strong>Nitrogen:</strong> ${record.nitrogen_level_ppm ? `${record.nitrogen_level_ppm} ppm` : 'N/A'}</p>
                    <p><strong>Phosphorus:</strong> ${record.phosphorus_level_ppm ? `${record.phosphorus_level_ppm} ppm` : 'N/A'}</p>
                    <p><strong>Potassium:</strong> ${record.potassium_level_ppm ? `${record.potassium_level_ppm} ppm` : 'N/A'}</p>
                    <p><strong>Notes:</strong> ${record.notes || 'N/A'}</p>
                    <div class="card-actions">
                        <button class="btn btn-icon edit-btn" data-id="${record.reading_id}" data-type="soil"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-icon delete-btn" data-id="${record.reading_id}" data-type="soil"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                soilReadingsListDiv.appendChild(readingCard);
            });
            attachActionListeners(soilReadingsListDiv);
        }
    }
    catch (error) {
        console.error("Error fetching soil readings:", error);
        soilReadingsListDiv.innerHTML = `<p class="message error">Failed to load soil readings: ${error.message}.</p>`;
    }
}

async function fetchInputRecords() {
    const inputsListDiv = document.getElementById('inputs-list');
    if (!inputsListDiv) return;

    inputsListDiv.innerHTML = '<p>Loading input records...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/inputs/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const inputs = await response.json();

        inputsListDiv.innerHTML = '';

        if (inputs.length === 0) {
            inputsListDiv.innerHTML = '<p>No input records found. Add some!</p>';
        } else {
            inputs.forEach(record => {
                const inputCard = document.createElement('div');
                inputCard.className = 'card';
                inputCard.innerHTML = `
                    <h3>Input ID: ${record.input_id} - ${record.input_name} (${record.input_type})</h3>
                    <p><strong>Date:</strong> ${record.usage_date}</p>
                    <p><strong>Quantity:</strong> ${record.quantity_used} ${record.unit}</p>
                    <p><strong>Associated Crop:</strong> ${record.crop_name || 'N/A'}</p>
                    <p><strong>Location:</strong> ${record.field_location || 'N/A'}</p>
                    <p><strong>Notes:</strong> ${record.notes || 'N/A'}</p>
                    <div class="card-actions">
                        <button class="btn btn-icon edit-btn" data-id="${record.input_id}" data-type="input"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-icon delete-btn" data-id="${record.input_id}" data-type="input"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                inputsListDiv.appendChild(inputCard);
            });
            attachActionListeners(inputsListDiv);
        }
    } catch (error) {
        console.error("Error fetching input records:", error);
        displayMessage('add-input-message', `Failed to load input records: ${error.message}.`, 'error');
    }
}

// New function to populate input dropdowns for cost tracking
async function fetchInputsForDropdown() {
    const costInputIdSelect = document.getElementById('costInputId');
    const editCostInputIdSelect = document.getElementById('editCostInputId');

    if (!costInputIdSelect && !editCostInputIdSelect) return;

    try {
        const response = await fetch(`${API_BASE_URL}/inputs/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const inputs = await response.json();

        const inputSelects = [costInputIdSelect, editCostInputIdSelect];

        inputSelects.forEach(selectElement => {
            if (selectElement) {
                const currentSelectedValue = selectElement.value;
                selectElement.innerHTML = '<option value="">Select an input record (Optional)</option>';
                inputs.forEach(input => {
                    const option = document.createElement('option');
                    option.value = input.input_id;
                    option.textContent = `${input.input_name} (${input.usage_date}) - ID: ${input.input_id}`;
                    selectElement.appendChild(option);
                });
                selectElement.value = currentSelectedValue; // Re-select previously chosen option
            }
        });

    } catch (error) {
        console.error("Error fetching inputs for dropdown:", error);
        if (costInputIdSelect) costInputIdSelect.innerHTML = '<option value="">Failed to load inputs</option>';
        if (editCostInputIdSelect) editCostInputIdSelect.innerHTML = '<option value="">Failed to load inputs</option>';
    }
}

async function fetchLatestWeather() {
    const weatherDisplayDiv = document.getElementById('weather-display');
    if (!weatherDisplayDiv) return;

    weatherDisplayDiv.innerHTML = '<div class="card"><h3>Current Weather</h3><p><strong>Loading weather data...</strong></p></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/weather/latest/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const weather = await response.json();

        weatherDisplayDiv.innerHTML = `
            <div class="card">
                <h3>Current Weather for ${weather.location || 'Farm'}</h3>
                <p><strong>Date:</strong> ${weather.record_date}</p>
                <p><strong>Description:</strong> ${weather.weather_description || 'N/A'}</p>
                <p><strong>Max Temp:</strong> ${weather.temperature_max_celsius ? `${weather.temperature_max_celsius}°C` : 'N/A'}</p>
                <p><strong>Min Temp:</strong> ${weather.temperature_min_celsius ? `${weather.temperature_min_celsius}°C` : 'N/A'}</p>
                <p><strong>Precipitation (1h):</strong> ${weather.precipitation_mm ? `${weather.precipitation_mm} mm` : 'N/A'}</p>
                <p><strong>Humidity:</strong> ${weather.humidity_percentage ? `${weather.humidity_percentage}%` : 'N/A'}</p>
                <p><strong>Wind Speed:</strong> ${weather.wind_speed_kph ? `${weather.wind_speed_kph} kph` : 'N/A'}</p>
            </div>
        `;
    } catch (error) {
        console.error("Error fetching latest weather:", error);
        weatherDisplayDiv.innerHTML = `<div class="card"><p class="message error">Failed to load weather: ${error.message}.</p></div>`;
    }
}

async function triggerWeatherFetch() {
    displayMessage('weather-message', 'Fetching latest weather from external API...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/weather/fetch_and_store/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const storedWeather = await response.json();
        displayMessage('weather-message', `Weather for ${storedWeather.record_date} (${storedWeather.location}) stored successfully!`);
        fetchLatestWeather();
    } catch (error) {
        console.error("Error triggering weather fetch:", error);
        displayMessage('weather-message', `Failed to fetch weather: ${error.message}`, 'error');
    }
}


// --- Action Handlers (Add, Update, Delete) ---

async function addCrop(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const cropData = {};
    formData.forEach((value, key) => {
        if (key === 'expected_yield_per_acre' && value) {
            cropData[key] = parseFloat(value);
        } else if (value) {
            cropData[key] = value;
        }
    });

    if (!cropData.planting_season) delete cropData.planting_season;
    if (cropData.expected_yield_per_acre === null || isNaN(cropData.expected_yield_per_acre)) {
        delete cropData.expected_yield_per_acre;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/crops/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cropData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const newCrop = await response.json();
        displayMessage('add-crop-message', `Crop "${newCrop.crop_name}" added successfully!`);
        form.reset();
        fetchCrops(); // Refresh crops and dropdowns
        fetchTotalYieldByCrop(); // Refresh overview chart
        fetchYieldForecast(); // Refresh yield forecast on crop addition
    }
    catch (error) {
        console.error("Error adding crop:", error);
        displayMessage('add-crop-message', `Failed to add crop: ${error.message}`, 'error');
    }
}

async function addYield(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const yieldData = {};
    formData.forEach((value, key) => {
        if (key === 'crop_id' || key === 'actual_yield') {
            yieldData[key] = parseFloat(value);
        } else if (value) {
            yieldData[key] = value;
        }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/yields/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(yieldData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const newYield = await response.json();
        displayMessage('add-yield-message', `Yield for ${newYield.crop_name || 'selected crop'} added successfully!`);
        form.reset();
        fetchYields();
        google.charts.setOnLoadCallback(drawYieldChart);
        fetchTotalYieldByCrop(); // Refresh overview chart
        fetchYieldForecast(); // Refresh yield forecast on yield addition
    }
    catch (error) {
        console.error("Error adding yield:", error);
        displayMessage('add-yield-message', `Failed to add yield: ${error.message}`, 'error');
    }
}

async function addSoilReading(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const readingData = {};
    formData.forEach((value, key) => {
        if (key === 'crop_id' || key.includes('level_ppm') || key === 'soil_moisture_percentage' || key === 'ph_level') {
            readingData[key] = value ? parseFloat(value) : null;
        } else if (value) {
            readingData[key] = value;
        }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/soil_readings/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(readingData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const newReading = await response.json();
        displayMessage('add-soil-message', `Soil reading (${newReading.reading_date}) added successfully!`);
        form.reset();
        fetchSoilReadings();
        fetchAverageSoilParameters(); // Refresh overview chart
        fetchFarmAdvice(); // Refresh farm advice
    }
    catch (error) {
        console.error("Error adding soil reading:", error);
        displayMessage('add-soil-message', `Failed to add soil reading: ${error.message}`, 'error');
    }
}

async function addInputRecord(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const inputData = {};
    formData.forEach((value, key) => {
        if (key === 'crop_id' || key === 'quantity_used') {
            inputData[key] = value ? parseFloat(value) : null;
        } else if (value) {
            inputData[key] = value;
        }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/inputs/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const newRecord = await response.json();
        displayMessage('add-input-message', `${newRecord.input_name} record added successfully!`);
        form.reset();
        fetchInputRecords();
        fetchInputsForDropdown(); // Refresh dropdown for input costs
    }
    catch (error) {
        console.error("Error adding input record:", error);
        displayMessage('add-input-message', `Failed to add input record: ${error.message}`, 'error');
    }
}

// New function: Add Input Cost
async function addInputCost(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const costData = {};
    formData.forEach((value, key) => {
        if (key === 'input_id' && value) {
            costData[key] = parseInt(value); // input_id is an integer
        } else if (key === 'cost_amount') {
            costData[key] = parseFloat(value);
        } else if (value) {
            costData[key] = value;
        }
    });

    // Ensure input_id is null if not selected
    if (costData.input_id === null || isNaN(costData.input_id)) {
        costData.input_id = null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/input_costs/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(costData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const newCost = await response.json();
        displayMessage('add-input-cost-message', `Cost for "${newCost.item_name}" added successfully!`);
        form.reset();
        fetchInputCosts(); // Refresh input cost list
        fetchTotalInputCostsByInputType(); // Refresh input cost chart
    } catch (error) {
        console.error("Error adding input cost:", error);
        displayMessage('add-input-cost-message', `Failed to add input cost: ${error.message}`, 'error');
    }
}


// Function to handle update forms
async function handleUpdate(event) {
    event.preventDefault();
    const form = event.target;
    const formId = form.id;
    let id, endpoint, messageElementId, fetchDataFunc, modalIdToHide;
    let updateData = {};
    const formData = new FormData(form);

    switch (formId) {
        case 'edit-crop-form':
            id = document.getElementById('editCropId').value;
            endpoint = `/crops/${id}`;
            messageElementId = 'edit-crop-message';
            fetchDataFunc = fetchCrops;
            modalIdToHide = 'editCropModal';
            formData.forEach((value, key) => {
                if (key === 'expected_yield_per_acre' && value) {
                    updateData[key] = parseFloat(value);
                } else if (value) {
                    updateData[key] = value;
                }
            });
            if (!updateData.planting_season) updateData.planting_season = null;
            if (updateData.expected_yield_per_acre === null || isNaN(updateData.expected_yield_per_acre)) {
                updateData.expected_yield_per_acre = null;
            }
            break;
        case 'edit-yield-form':
            id = document.getElementById('editYieldId').value;
            endpoint = `/yields/${id}`;
            messageElementId = 'edit-yield-message';
            fetchDataFunc = fetchYields;
            modalIdToHide = 'editYieldModal';
            formData.forEach((value, key) => {
                if (key === 'crop_id' || key === 'actual_yield') {
                    updateData[key] = parseFloat(value);
                } else if (value) {
                    updateData[key] = value;
                }
            });
            break;
        case 'edit-soil-form':
            id = document.getElementById('editSoilReadingId').value;
            endpoint = `/soil_readings/${id}`;
            messageElementId = 'edit-soil-message';
            fetchDataFunc = fetchSoilReadings;
            modalIdToHide = 'editSoilModal';
            formData.forEach((value, key) => {
                if (key === 'crop_id' || key.includes('level_ppm') || key === 'soil_moisture_percentage' || key === 'ph_level') {
                    updateData[key] = value ? parseFloat(value) : null;
                } else if (value) {
                    updateData[key] = value;
                }
            });
            break;
        case 'edit-input-form':
            id = document.getElementById('editInputId').value;
            endpoint = `/inputs/${id}`;
            messageElementId = 'edit-input-message';
            fetchDataFunc = fetchInputRecords;
            modalIdToHide = 'editInputModal';
            formData.forEach((value, key) => {
                if (key === 'crop_id' || key === 'quantity_used') {
                    updateData[key] = value ? parseFloat(value) : null;
                } else if (value) {
                    updateData[key] = value;
                }
            });
            break;
        case 'edit-input-cost-form': // New case for input costs
            id = document.getElementById('editCostId').value;
            endpoint = `/input_costs/${id}`;
            messageElementId = 'edit-input-cost-message';
            fetchDataFunc = fetchInputCosts;
            modalIdToHide = 'editInputCostModal';
            formData.forEach((value, key) => {
                if (key === 'input_id' && value) {
                    updateData[key] = parseInt(value);
                } else if (key === 'cost_amount') {
                    updateData[key] = parseFloat(value);
                } else if (value) {
                    updateData[key] = value;
                }
            });
            // Ensure input_id is null if not selected
            if (updateData.input_id === null || isNaN(updateData.input_id)) {
                updateData.input_id = null;
            }
            break;
        default:
            console.error("Unknown form ID for update:", formId);
            return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        displayMessage(messageElementId, `${formId.replace('edit-', '').replace('-form', '')} updated successfully!`);
        fetchDataFunc();
        if (formId === 'edit-yield-form') {
            google.charts.setOnLoadCallback(drawYieldChart);
            fetchTotalYieldByCrop(); // Refresh overview chart
            fetchYieldForecast(); // Refresh yield forecast on yield update
        }
        if (formId === 'edit-soil-form') {
            fetchAverageSoilParameters(); // Refresh overview chart
            fetchFarmAdvice(); // Refresh farm advice
        }
        if (formId === 'edit-input-form') { // If input usage is updated, related costs might be impacted
            fetchInputsForDropdown();
        }
        if (formId === 'edit-input-cost-form') { // If input cost is updated, refresh its chart
            fetchTotalInputCostsByInputType();
        }

        hideEditModal(modalIdToHide);

    } catch (error) {
        console.error(`Error updating ${formId}:`, error);
        displayMessage(messageElementId, `Failed to update: ${error.message}`, 'error');
    }
}


async function handleDelete(id, type) {
    showConfirmation(`Are you sure you want to delete this ${type} record (ID: ${id})? This action cannot be undone.`, async () => {
        hideConfirmation();

        let endpoint, fetchDataFunc;
        switch (type) {
            case 'crop':
                endpoint = `/crops/${id}`;
                fetchDataFunc = fetchCrops;
                break;
            case 'yield':
                endpoint = `/yields/${id}`;
                fetchDataFunc = fetchYields;
                break;
            case 'soil':
                endpoint = `/soil_readings/${id}`;
                fetchDataFunc = fetchSoilReadings;
                break;
            case 'input':
                endpoint = `/inputs/${id}`;
                fetchDataFunc = fetchInputRecords;
                break;
            case 'input-cost': // New case for input costs
                endpoint = `/input_costs/${id}`;
                fetchDataFunc = fetchInputCosts;
                break;
            default:
                console.error("Unknown type for delete:", type);
                return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            displayMessage('dashboard-grid', `${type.charAt(0).toUpperCase() + type.slice(1)} record deleted successfully!`, 'success');
            fetchDataFunc();
            if (type === 'yield') {
                google.charts.setOnLoadCallback(drawYieldChart);
                fetchTotalYieldByCrop(); // Refresh overview chart
                fetchYieldForecast(); // Refresh yield forecast on yield deletion
            }
            if (type === 'soil') {
                fetchAverageSoilParameters(); // Refresh overview chart
                fetchFarmAdvice(); // Refresh farm advice
            }
            if (type === 'crop') {
                fetchTotalYieldByCrop(); // Refresh overview chart
                fetchYieldForecast(); // Refresh yield forecast on crop deletion
            }
            if (type === 'input') {
                fetchInputsForDropdown(); // If input usage is deleted, related costs might be impacted
                fetchInputCosts(); // Refresh input costs as some might be linked to this input
                fetchTotalInputCostsByInputType(); // Refresh chart
            }
            if (type === 'input-cost') { // If input cost is deleted, refresh its chart
                fetchTotalInputCostsByInputType();
            }


        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            displayMessage('dashboard-grid', `Failed to delete ${type}: ${error.message}`, 'error');
        }
    });
}

async function handleEdit(id, type) {
    try {
        let endpoint;
        if (type === 'soil') {
            endpoint = `${API_BASE_URL}/soil_readings/${id}`;
        } else if (type === 'input-cost') { // New case for input costs
            endpoint = `${API_BASE_URL}/input_costs/${id}`;
        }
        else {
            endpoint = `${API_BASE_URL}/${type}s/${id}`;
        }

        const response = await fetch(endpoint);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (type === 'crop') {
            showEditModal('editCropModal', data);
        } else if (type === 'yield') {
            showEditModal('editYieldModal', data);
        } else if (type === 'soil') {
            showEditModal('editSoilModal', data);
        } else if (type === 'input') {
            showEditModal('editInputModal', data);
        } else if (type === 'input-cost') { // New case for input costs
            showEditModal('editInputCostModal', data);
        }
    } catch (error) {
        console.error(`Error fetching ${type} for edit:`, error);
        displayMessage('dashboard-grid', `Failed to load ${type} data for editing: ${error.message}`, 'error');
    }
}


function attachActionListeners(container) {
    container.querySelectorAll('.edit-btn').forEach(button => {
        button.onclick = () => handleEdit(button.dataset.id, button.dataset.type);
    });
    container.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = () => handleDelete(button.dataset.id, button.dataset.type);
    });
}


async function drawYieldChart() {
    const yieldChartContainer = document.getElementById('yieldChartContainer');
    if (!yieldChartContainer) return;

    const yieldChartMessage = document.getElementById('yield-chart-message');

    try {
        const response = await fetch(`${API_BASE_URL}/yields/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const yields = await response.json();

        if (yields.length === 0) {
            if (yieldChartMessage) yieldChartMessage.textContent = "No yield data available to display chart.";
            yieldChartContainer.innerHTML = '<p id="yield-chart-message" class="message">No yield data available to display chart.</p>';
            return;
        }

        if (yieldChartMessage) yieldChartMessage.textContent = "";

        const groupedYields = {};
        const allDates = new Set();
        yields.forEach(record => {
            if (!groupedYields[record.crop_name]) {
                groupedYields[record.crop_name] = {};
            }
            groupedYields[record.crop_name][record.harvest_date] = record.actual_yield;
            allDates.add(record.harvest_date);
        });

        const sortedDates = Array.from(allDates).sort();

        const dataTable = new google.visualization.DataTable();
        dataTable.addColumn('date', 'Date');

        const cropNames = Object.keys(groupedYields).sort();
        cropNames.forEach(cropName => {
            dataTable.addColumn('number', cropName + ' Yield (' + yields[0].unit + ')');
        });

        sortedDates.forEach(dateStr => {
            const row = [new Date(dateStr)];
            cropNames.forEach(cropName => {
                const yieldValue = groupedYields[cropName][dateStr] || null;
                row.push(yieldValue);
            });
            dataTable.addRow(row);
        });

        const options = {
            title: 'Crop Yield Trends Over Time',
            curveType: 'function',
            legend: { position: 'bottom' },
            hAxis: {
                title: 'Date',
                format: 'MMM dd,yyyy'
            },
            vAxis: {
                title: 'Actual Yield',
                minValue: 0
            },
            pointSize: 5,
            lineWidth: 2,
            chartArea: {
                left: '10%',
                top: '10%',
                width: '80%',
                height: '70%'
            }
        };

        yieldChartContainer.innerHTML = '';
        const chartDiv = document.createElement('div');
        chartDiv.style.width = '100%';
        chartDiv.style.height = '100%';
        yieldChartContainer.appendChild(chartDiv);

        const chart = new google.visualization.LineChart(chartDiv);
        chart.draw(dataTable, options);

    } catch (error) {
        console.error("Error drawing yield chart:", error);
        if (yieldChartMessage) yieldChartMessage.textContent = `Failed to load yield chart: ${error.message}.`;
    }
}


// New Chart Functions for Phase 8: Enhanced Reporting

async function fetchTotalYieldByCrop() {
    const totalYieldChartDiv = document.getElementById('total-yield-chart');
    if (!totalYieldChartDiv) return;

    try {
        const response = await fetch(`${API_BASE_URL}/reports/total_yield_by_crop/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.length === 0) {
            totalYieldChartDiv.innerHTML = '<p class="message">No yield data to show total yields by crop.</p>';
            return;
        }

        const chartData = new google.visualization.DataTable();
        chartData.addColumn('string', 'Crop');
        chartData.addColumn('number', 'Total Yield');

        data.forEach(item => {
            chartData.addRow([`${item.crop_name} (${item.unit})`, parseFloat(item.total_yield)]);
        });

        const options = {
            title: 'Total Yield by Crop',
            pieHole: 0.4, // For a donut chart
            legend: { position: 'labeled' }, // Show labels directly on slices
            chartArea: {
                left: '5%',
                top: '10%',
                width: '90%',
                height: '80%'
            }
        };

        totalYieldChartDiv.innerHTML = ''; // Clear loading message
        const chart = new google.visualization.PieChart(totalYieldChartDiv);
        chart.draw(chartData, options);

    } catch (error) {
        console.error("Error fetching total yield by crop:", error);
        totalYieldChartDiv.innerHTML = `<p class="message error">Failed to load total yield chart: ${error.message}.</p>`;
    }
}

async function fetchAverageSoilParameters() {
    const averageSoilChartDiv = document.getElementById('average-soil-chart');
    if (!averageSoilChartDiv) return;

    try {
        const response = await fetch(`${API_BASE_URL}/reports/average_soil_parameters/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Check if all values are null or 0, indicating no data
        const hasData = Object.values(data).some(value => value !== null && value !== 0);
        if (!hasData) {
            averageSoilChartDiv.innerHTML = '<p class="message">No soil data to show average parameters.</p>';
            return;
        }

        const chartData = new google.visualization.DataTable();
        chartData.addColumn('string', 'Parameter');
        chartData.addColumn('number', 'Average Value');

        // Only add rows for parameters that have non-null values
        if (data.avg_moisture !== null) chartData.addRow(['Moisture (%)', data.avg_moisture]);
        if (data.avg_ph !== null) chartData.addRow(['pH Level', data.avg_ph]);
        if (data.avg_nitrogen !== null) chartData.addRow(['Nitrogen (ppm)', data.avg_nitrogen]);
        if (data.avg_phosphorus !== null) chartData.addRow(['Phosphorus (ppm)', data.avg_phosphorus]);
        if (data.avg_potassium !== null) chartData.addRow(['Potassium (ppm)', data.avg_potassium]);

        const options = {
            title: 'Average Soil Parameters',
            legend: { position: 'none' },
            hAxis: { title: 'Parameter' },
            vAxis: { title: 'Average Value', minValue: 0 },
            chartArea: {
                left: '15%',
                top: '10%',
                width: '70%',
                height: '70%'
            }
        };

        averageSoilChartDiv.innerHTML = ''; // Clear loading message
        const chart = new google.visualization.ColumnChart(averageSoilChartDiv);
        chart.draw(chartData, options);

    } catch (error) {
        console.error("Error fetching average soil parameters:", error);
        averageSoilChartDiv.innerHTML = `<p class="message error">Failed to load average soil parameters chart: ${error.message}.</p>`;
    }
}

// New Function for Phase 9: Fetch Farm Health Advice
async function fetchFarmAdvice() {
    const farmAdviceListDiv = document.getElementById('farm-advice-list');
    if (!farmAdviceListDiv) return;

    farmAdviceListDiv.innerHTML = '<p>Loading farm advice...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/advice/farm_health/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const adviceMessages = await response.json();

        farmAdviceListDiv.innerHTML = ''; // Clear loading message

        if (adviceMessages.length === 0) {
            farmAdviceListDiv.innerHTML = '<p class="message info">No specific advice at this time. All parameters appear within optimal ranges.</p>';
        } else {
            adviceMessages.forEach(advice => {
                const adviceCard = document.createElement('div');
                adviceCard.className = `card message ${advice.type}`; // Use message classes for styling
                adviceCard.innerHTML = `<p>${advice.message}</p>`;
                farmAdviceListDiv.appendChild(adviceCard);
            });
        }
    } catch (error) {
        console.error("Error fetching farm advice:", error);
        farmAdviceListDiv.innerHTML = `<p class="message error">Failed to load farm advice: ${error.message}.</p>`;
    }
}

// New Function for Phase 10: Fetch Input Costs
async function fetchInputCosts() {
    const inputCostsListDiv = document.getElementById('input-costs-list');
    if (!inputCostsListDiv) return;

    inputCostsListDiv.innerHTML = '<p>Loading input cost records...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/input_costs/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const costs = await response.json();

        inputCostsListDiv.innerHTML = '';

        if (costs.length === 0) {
            inputCostsListDiv.innerHTML = '<p>No input cost records found. Add some!</p>';
        } else {
            costs.forEach(record => {
                const costCard = document.createElement('div');
                costCard.className = 'card';
                costCard.innerHTML = `
                    <h3>Cost ID: ${record.cost_id} - ${record.item_name}</h3>
                    <p><strong>Purchase Date:</strong> ${record.cost_date}</p>
                    <p><strong>Amount:</strong> ${record.cost_amount} ${record.currency}</p>
                    <p><strong>Associated Input:</strong> ${record.input_type || 'N/A'} (ID: ${record.input_id || 'N/A'})</p>
                    <p><strong>Notes:</strong> ${record.notes || 'N/A'}</p>
                    <div class="card-actions">
                        <button class="btn btn-icon edit-btn" data-id="${record.cost_id}" data-type="input-cost"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-icon delete-btn" data-id="${record.cost_id}" data-type="input-cost"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                inputCostsListDiv.appendChild(costCard);
            });
            attachActionListeners(inputCostsListDiv);
        }
    } catch (error) {
        console.error("Error fetching input costs:", error);
        inputCostsListDiv.innerHTML = `<p class="message error">Failed to load input cost records: ${error.message}.</p>`;
    }
}

// New Function for Phase 10: Draw Total Input Costs Chart
async function fetchTotalInputCostsByInputType() {
    const totalInputCostChartDiv = document.getElementById('total-input-cost-chart');
    if (!totalInputCostChartDiv) return;

    try {
        const response = await fetch(`${API_BASE_URL}/reports/total_input_cost_by_type/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.length === 0) {
            totalInputCostChartDiv.innerHTML = '<p class="message">No input cost data to show total costs by type.</p>';
            return;
        }

        const chartData = new google.visualization.DataTable();
        chartData.addColumn('string', 'Category');
        chartData.addColumn('number', 'Total Cost');

        data.forEach(item => {
            chartData.addRow([`${item.category} (${item.currency})`, parseFloat(item.total_cost)]);
        });

        const options = {
            title: 'Total Input Cost by Category',
            legend: { position: 'right' },
            bar: { groupWidth: '70%' },
            hAxis: { title: 'Total Cost', minValue: 0 },
            vAxis: { title: 'Category' },
            chartArea: {
                left: '20%',
                top: '10%',
                width: '70%',
                height: '80%'
            }
        };

        totalInputCostChartDiv.innerHTML = ''; // Clear loading message
        const chart = new google.visualization.BarChart(totalInputCostChartDiv); // Using BarChart for horizontal bars
        chart.draw(chartData, options);

    } catch (error) {
        console.error("Error fetching total input costs by type:", error);
        totalInputCostChartDiv.innerHTML = `<p class="message error">Failed to load total input cost chart: ${error.message}.</p>`;
    }
}

// New Function for Phase 11: Fetch Yield Forecast
async function fetchYieldForecast() {
    const yieldForecastListDiv = document.getElementById('yield-forecast-list');
    if (!yieldForecastListDiv) return;

    yieldForecastListDiv.innerHTML = '<p>Loading yield forecasts...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/reports/yield_forecast/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const forecasts = await response.json();

        yieldForecastListDiv.innerHTML = '';

        if (forecasts.length === 0) {
            yieldForecastListDiv.innerHTML = '<p class="message info">No historical yield data to generate forecasts.</p>';
        } else {
            forecasts.forEach(forecast => {
                const forecastCard = document.createElement('div');
                forecastCard.className = 'card';
                const yieldText = forecast.average_yield !== null ? `${forecast.average_yield.toFixed(2)} ${forecast.unit || 'units'}` : 'No data for prediction';
                forecastCard.innerHTML = `
                    <h3>${forecast.crop_name}</h3>
                    <p><strong>Avg. Historical Yield:</strong> ${yieldText}</p>
                    <p class="text-sm text-gray-500">
                        <em>This is an average of past actual yields for this crop.</em>
                    </p>
                `;
                yieldForecastListDiv.appendChild(forecastCard);
            });
        }
    } catch (error) {
        console.error("Error fetching yield forecast:", error);
        yieldForecastListDiv.innerHTML = `<p class="message error">Failed to load yield forecasts: ${error.message}.</p>`;
    }
}

// New Function for Phase 12: Export All Data as CSV
async function exportAllDataAsCsv() {
    displayMessage('export-message', 'Preparing data for export...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/reports/export_all_data/csv`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const csvDataDict = await response.json(); // Expected: { "filename.csv": "csv_content", ... }

        if (Object.keys(csvDataDict).length === 0) {
            displayMessage('export-message', 'No data available to export.', 'info');
            return;
        }

        let downloadedCount = 0;
        for (const filename in csvDataDict) {
            if (csvDataDict.hasOwnProperty(filename)) {
                const csvContent = csvDataDict[filename];
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                if (link.download !== undefined) { // Feature detection for HTML5 download attribute
                    link.setAttribute('href', URL.createObjectURL(blob));
                    link.setAttribute('download', filename);
                    link.style.visibility = 'hidden'; // Hide the link
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    downloadedCount++;
                } else {
                    console.warn(`Download not supported for ${filename}.`);
                }
            }
        }
        if (downloadedCount > 0) {
            displayMessage('export-message', `Successfully exported ${downloadedCount} CSV files.`, 'success');
        } else {
            displayMessage('export-message', `No files were downloaded. Your browser may not support direct CSV downloads.`, 'warning');
        }

    } catch (error) {
        console.error("Error exporting data:", error);
        displayMessage('export-message', `Failed to export data: ${error.message}`, 'error');
    }
}


// --- Initial Setup on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Load Google Charts packages first
    google.charts.load('current', { 'packages': ['corechart', 'bar'] }); // 'bar' package for ColumnChart and BarChart

    // Set a callback to run when the Google Charts library is loaded.
    google.charts.setOnLoadCallback(() => {
        // Initial fetches when the page loads
        fetchCrops();
        fetchLatestWeather();
        fetchYields();
        drawYieldChart();
        fetchSoilReadings();
        fetchInputRecords();
        fetchInputsForDropdown();
        fetchInputCosts();

        // New fetches for overview charts, advice, and forecast
        fetchTotalYieldByCrop();
        fetchAverageSoilParameters();
        fetchFarmAdvice();
        fetchTotalInputCostsByInputType();
        fetchYieldForecast();
    });

    // Main form submissions (using nullish coalescing for robustness)
    document.getElementById('add-crop-form')?.addEventListener('submit', addCrop);
    document.getElementById('fetchWeatherBtn')?.addEventListener('click', triggerWeatherFetch);
    document.getElementById('add-yield-form')?.addEventListener('submit', addYield);
    document.getElementById('add-soil-form')?.addEventListener('submit', addSoilReading);
    document.getElementById('add-input-form')?.addEventListener('submit', addInputRecord);
    document.getElementById('add-input-cost-form')?.addEventListener('submit', addInputCost);
    document.getElementById('exportAllCsvBtn')?.addEventListener('click', exportAllDataAsCsv); // New event listener

    // Modal Confirmation Button Listeners
    modalConfirmBtn.addEventListener('click', () => {
        if (currentConfirmAction) {
            currentConfirmAction();
        }
    });
    modalCancelBtn.addEventListener('click', hideConfirmation);
    customModal.addEventListener('click', (e) => {
        // If clicking directly on the overlay, hide modal
        if (e.target === customModal) {
            hideConfirmation();
        }
    });

    // Universal Modal Close Buttons (for X marks on all modals)
    allCloseButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const modalElement = e.target.closest('.modal');
            if (modalElement) {
                // If it's the customModal's X, hide confirmation
                if (modalElement.id === 'customModal') {
                    hideConfirmation();
                } else { // Otherwise, hide the specific edit modal
                    hideEditModal(modalElement.id);
                }
            }
        });
    });

    // Edit form submissions
    document.getElementById('edit-crop-form')?.addEventListener('submit', handleUpdate);
    document.getElementById('edit-yield-form')?.addEventListener('submit', handleUpdate);
    document.getElementById('edit-soil-form')?.addEventListener('submit', handleUpdate);
    document.getElementById('edit-input-form')?.addEventListener('submit', handleUpdate);
    document.getElementById('edit-input-cost-form')?.addEventListener('submit', handleUpdate);
});
