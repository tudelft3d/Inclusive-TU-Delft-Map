import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import layers_definition_json from "../assets/threejs/buildings/thematic_codelist-definition.json" assert {type: "json"};

/**
 * InfoPane class - handles all info pane UI logic
 */
export class InfoPane {
    constructor(paneElement, picker = null) {
        this.pane = paneElement;
        this.picker = picker;
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
                name: attrs["Name"] || attrs["Name (EN)"] || layers_definition_json[attrs["code"]]["Name (EN)"],
                nameNL: attrs["Name (NL)"],
                nicknames: attrs.Nicknames ? attrs.Nicknames.join(", ") : undefined,
                address: attrs.Address,
            };
        }

        return null;
    }

    _getBuildingDataFromName_alt(objectName) {
        if (!objectName) return null;

        // Remove the LOD suffix (e.g., "-lod_2", "-lod_0")
        const cleanName = objectName.replace(/-lod_\d+$/, '');

        // Look up in CityJSON
        const cityObjects = cityjson.CityObjects;

        if (cityObjects && cityObjects[cleanName]) {
            const buildingData = cityObjects[cleanName];

            return buildingData;
        }

        return null;
    }

    /**
     * Show info for a picked object
     */
    show(data) {

        const raw_data = data;

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
        if (this.picker) {
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

        this.show_alt(raw_data);
    }

    show_alt(object_threejs_name) {

        // TODO add checks for missing data

        this.pane.innerHTML = "";

        const object_json = this._getBuildingDataFromName_alt(object_threejs_name);

        this._add_infoPane_title(object_json);

        // Create content container
        let content_div = document.createElement("div");
        content_div.className = "info-pane-content";
        this.pane.appendChild(content_div);

        const wanted_attributes = [
            "Address",
            "Phone number",
            "Email"
        ];

        wanted_attributes.forEach((attribute_name) => {
            this._add_infoPane_object(object_json, attribute_name, content_div);
        });

        // Opening Hours configuration
        const opening_hours_config = {
            title: "Opening Hours",
            attributes: [
                "Opening hours (Monday)",
                "Opening hours (Tuesday)",
                "Opening hours (Wednesday)",
                "Opening hours (Thursday)",
                "Opening hours (Friday)",
                "Opening hours (Saturday)",
                "Opening hours (Sunday)",
            ],
            open: true,
            labelTransform: (attr) => {
                // Extract day name from "Opening hours (Monday)" -> "Monday"
                const match = attr.match(/\(([^)]+)\)/);
                return match ? match[1] : attr;
            }
        };

        this._add_infoPane_details_section(object_json, opening_hours_config, content_div);

        // Wheelchair Accessibility configuration
        const wheelchair_config = {
            title: "Wheelchair Accessibility",
            attributes: [
                "Wheelchair accessibility (Parking)",
                "Wheelchair accessibility (Entrances)",
                "Wheelchair accessibility (Elevators)",
            ],
            open: false,
            labelTransform: (attr) => {
                // Extract category from "Wheelchair accessibility (Parking)" -> "Parking"
                const match = attr.match(/\(([^)]+)\)/);
                return match ? match[1] : attr;
            }
        };

        this._add_infoPane_details_section(object_json, wheelchair_config, content_div);

        this._add_infoPane_floorplan_button();

        this._add_infoPane_extra_buttons();

    }


    _add_infoPane_title(object_json) {

        let div = document.createElement("div");

        div.className = "info-pane-header";

        let h3 = document.createElement("h3");

        h3.className = "info-pane-title";

        const title_text = object_json.attributes["Name (EN)"];

        h3.appendChild(document.createTextNode(title_text));

        let close_button = document.createElement("button");

        close_button.className = "info-pane-close"
        close_button["aria-label"] = "Close";
        close_button.value = "&times";
        close_button.appendChild(document.createTextNode("x"));

        close_button.addEventListener('click', () => this.hide());

        div.appendChild(h3);
        div.appendChild(close_button);

        this.pane.appendChild(div);

    }

    _add_infoPane_object(object_json, attribute_name, container = null) {

        let div = document.createElement("div");
        div.className = "info-pane-row";


        let label_span = document.createElement("span");
        label_span.className = "info-pane-label";
        label_span.appendChild(document.createTextNode(attribute_name));


        let value_span = document.createElement("span");
        value_span.className = "info-pane-value";

        const attribute_value = object_json.attributes[attribute_name];

        // Check if it's a phone number or email and make it clickable
        if (attribute_name === "Phone number") {
            let link = document.createElement("a");
            link.href = `tel:${attribute_value}`;
            link.appendChild(document.createTextNode(attribute_value));
            value_span.appendChild(link);
        } else if (attribute_name === "Email") {
            let link = document.createElement("a");
            link.href = `mailto:${attribute_value}`;
            link.appendChild(document.createTextNode(attribute_value));
            value_span.appendChild(link);
        } else {
            value_span.appendChild(document.createTextNode(attribute_value));
        }


        div.appendChild(label_span);
        div.appendChild(value_span);

        const target = container || this.pane;
        target.appendChild(div);

    }


    /**
     * Add a collapsible details section with configurable options
     * @param {Object} object_json - The building JSON data
     * @param {Object} config - Configuration object
     * @param {string} config.title - Title of the details element
     * @param {Array<string>} config.attributes - Array of the underlying attributes
     * @param {boolean} config.open - Whether the details should be open by default, the default is false
     * @param {Function} config.labelTransform - Optional function to transform attribute names for display
     * @param {HTMLElement} container - Optional container element to append to
     */
    _add_infoPane_details_section(object_json, config, container = null) {
        const {
            title,
            attributes,
            open = false,
            labelTransform = null
        } = config;

        // Check if any of the attributes exist before creating the section, otherwise do not include
        const hasData = attributes.some(attr => object_json.attributes[attr]);
        if (!hasData) return;

        let details = document.createElement("details");
        details.open = open;

        let summary = document.createElement("summary");
        let summary_span = document.createElement("span");
        summary_span.className = "info-pane-label";
        summary_span.appendChild(document.createTextNode(title));
        summary.appendChild(summary_span);

        details.appendChild(summary);

        attributes.forEach((attribute_name) => {
            const attribute_value = object_json.attributes[attribute_name];

            // Skip if attribute doesn't exist or is empty
            if (!attribute_value) return;

            // Transform the label if a transform function is provided, e.g. "Opening hours (Monday)" -> "Monday"
            const display_label = labelTransform
                ? labelTransform(attribute_name)
                : attribute_name;

            let div = document.createElement("div");
            div.className = "info-pane-row";

            let label_span = document.createElement("span");
            label_span.className = "info-pane-label";
            label_span.appendChild(document.createTextNode(display_label));

            let value_span = document.createElement("span");
            value_span.className = "info-pane-value";
            value_span.appendChild(document.createTextNode(attribute_value));

            div.appendChild(label_span);
            div.appendChild(value_span);

            details.appendChild(div);
        });

        const target = container || this.pane;
        target.appendChild(details);
    }


    _add_infoPane_floorplan_button() {

        let div = document.createElement("div");
        div.className = "info-pane-button-background";

        let button = document.createElement("button");
        button.className = "info-pane-button";

        let button_icon = document.createElement("i");
        button_icon.className = "fa-solid fa-layer-group";

        button.appendChild(button_icon);
        button.append(document.createTextNode("View Floorplan"));

        button.addEventListener('click', () => {
            if (this.picker) {
                this.picker.switchBuildingView();
            }
        });

        div.appendChild(button);
        this.pane.appendChild(div);

    }

    _add_infoPane_extra_buttons() {

        let div = document.createElement("div");
        div.className = "info-pane-button-background";
        div.classList.add("info-pane-row");


        let report_button_span = document.createElement("span");

        let report_button = document.createElement("button");
        report_button.className = "info-pane-button";

        report_button.append(document.createTextNode("Report Issue"));

        report_button.addEventListener('click', () => {
            console.log("Go to issue page");
        });

        report_button_span.appendChild(report_button);


        let book_room_button_span = document.createElement("span");

        let book_room_button = document.createElement("button");
        book_room_button.className = "info-pane-button";

        book_room_button.append(document.createTextNode("Book a room"));

        book_room_button.addEventListener('click', () => {
            console.log("Go to book room page");
        });

        book_room_button_span.appendChild(book_room_button);


        div.appendChild(report_button_span);
        div.appendChild(book_room_button_span);

        this.pane.appendChild(div);

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
        // Necessary to make the events happen
        this.mainContainer = document.getElementById("scene-container");
        this.movedDuringPointer = false;
        this.mainContainer.addEventListener("pointerdown", (e) => {
            if (!this.pane.contains(e.target)) return;
            this.movedDuringPointer = false;
            e.target.setPointerCapture(e.pointerId);
        });
        this.mainContainer.addEventListener("pointermove", (e) => {
            if (!this.pane.contains(e.target)) return;
            this.movedDuringPointer = true;
        });
        this.mainContainer.addEventListener("pointerup", (e) => {
            if (!this.pane.contains(e.target)) return;
            if (this.movedDuringPointer) return;
        });

        // Close the pane
        const closeBtn = this.pane.querySelector('.info-pane-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        const floorplanBtn = this.pane.querySelector('#info-pane-floorplan-btn');
        if (floorplanBtn && this.picker) {
            floorplanBtn.addEventListener('click', () => {
                this.buildingView.switchBuildingView();
            });
        }
    }
}