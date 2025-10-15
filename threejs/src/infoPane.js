import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

/**
 * InfoPane class - handles all info pane UI logic
 */
export class InfoPane {
    constructor(paneElement, buildingView = null) {
        this.pane = paneElement;
        this.buildingView = buildingView;
    }

    /**
     * Extract building data from CityJSON based on object name
     */
    _getBuildingDataFromName(objectName) {
        if (!objectName) return null;

        // Remove the LOD suffix (e.g., "-lod_2", "-lod_0")
        const cleanName = objectName.replace(/-lod_\d+$/, '');

        // Look up in CityJSON
        const cityObjects = cityjson.CityObjects;

        if (cityObjects && cityObjects[cleanName]) {
            const buildingData = cityObjects[cleanName];

            // Extract useful attributes
            const attrs = buildingData.attributes || {};

            return {
                name: attrs["Name (EN)"] || attrs["Name (NL)"] || cleanName,
                nameNL: attrs["Name (NL)"],
                nicknames: attrs.Nicknames ? attrs.Nicknames.join(", ") : undefined,
                address: attrs.Address,
            };
        }

        return null;
    }

    /**
     * Show info for a picked object
     */
    show(data) {
        // Store original name if it's a string
        const originalName = typeof data === 'string' ? data : null;

        // If data is a string (object name), look it up in CityJSON
        if (typeof data === 'string') {
            data = this._getBuildingDataFromName(data);
        }

        // If no data found, but we have a name, show that
        if (!data || Object.keys(data).length === 0) {
            if (originalName) {
                data = {
                    name: originalName,
                    Type: 'Building Object'
                };
            } else {
                this.hide();
                return;
            }
        }

        // Extract building name/title if it exists
        const title = data.name || data.buildingName || data.title || data["Name (EN)"] || 'Building Information';

        // Create structured HTML
        let html = `
            <div class="info-pane-header">
                <h3 class="info-pane-title">${title}</h3>
                <button class="info-pane-close" aria-label="Close">&times;</button>
            </div>
            <div class="info-pane-content">
        `;

        // Define which keys to exclude and which to prioritize
        const excludeKeys = [
            'name', 'buildingName', 'title', 'Name (EN)', 'key', 'icon_position',
            'Skip', '3D BAG Buildings IDs', 'bagIds', 'buildingType'
        ];

        // Priority fields to show first (in order)
        const priorityFields = [
            { key: 'nameNL', label: 'Name (NL)' },
            { key: 'nicknames', label: 'Nicknames' },
            { key: 'address', label: 'Address' },
            { key: 'spaceId', label: 'Building Code' },
            { key: 'buildingType', label: 'Type' }
        ];

        // Add priority fields first
        priorityFields.forEach(({ key, label }) => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
                html += `
                    <div class="info-pane-row">
                        <span class="info-pane-label">${label}:</span>
                        <span class="info-pane-value">${data[key]}</span>
                    </div>
                `;
            }
        });

        // Add other fields
        const entries = Object.entries(data).filter(([k]) =>
            !excludeKeys.includes(k) &&
            !priorityFields.some(pf => pf.key === k)
        );

        if (entries.length > 0) {
            entries.forEach(([key, value]) => {
                // Skip if value is undefined, null, empty string, or empty array
                if (value === undefined || value === null || value === '' ||
                    (Array.isArray(value) && value.length === 0)) {
                    return;
                }

                const formattedKey = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())
                    .trim();

                // Format arrays nicely
                const displayValue = Array.isArray(value) ? value.join(', ') : value;

                html += `
                    <div class="info-pane-row">
                        <span class="info-pane-label">${formattedKey}:</span>
                        <span class="info-pane-value">${displayValue}</span>
                    </div>
                `;
            });
        }

        html += `</div>`;

        // Add floor plan button if buildingView is available
        if (this.buildingView) {
            html += `
                <div class="info-pane-footer">
                    <button class="info-pane-floorplan-btn" id="info-pane-floorplan-btn">
                        <i class="fa-solid fa-layer-group"></i>
                        View Floorplan
                    </button>
                </div>
            `;
        }

        this.pane.innerHTML = html;
        this.pane.style.opacity = '1';
        this.pane.style.display = 'block'; // Keep it always visible, even with no info

        this._attachEventListeners();
    }

    /**
     * Hide the info pane
     */
    hide() {
        this.pane.style.opacity = '0';

        this.pane.innerHTML = '';
        this.pane.style.display = 'none';

        // setTimeout(() => {
        //     this.pane.innerHTML = '';
        //     this.pane.style.display = 'none';
        // }, 3000);
    }

    /**
     * Attach event listeners to pane elements
     */
    _attachEventListeners() {
        const closeBtn = this.pane.querySelector('.info-pane-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        const floorplanBtn = this.pane.querySelector('#info-pane-floorplan-btn');
        if (floorplanBtn && this.buildingView) {
            floorplanBtn.addEventListener('click', () => {
                this.buildingView.initiate_buildingView();
            });
        }
    }
}