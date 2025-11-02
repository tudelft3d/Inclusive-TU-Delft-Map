import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import infoPaneHierarchy from "../assets/threejs/buildings/info_pane-hierarchy.json" assert { type: "json" };
import layersDefinition from "../assets/threejs/buildings/thematic_codelist-definition.json" assert {type: "json"};

import { CjHelper } from "./cjHelper";
import { ObjectPicker } from "./objectPicker";


class Entry {

    constructor(attributeKey, displayName, config = { url: false, tel: false, mail: false, code: false, image: false }) {
        const { url, tel, mail, code, image } = config;

        // The Entry cannot be two of url, tel or mail at the same time
        const numberTrue = [url, tel, mail, code, image].filter(Boolean).length;
        if (numberTrue > 1) {
            console.error("Cannot have multiple config properties.")
            return;
        }

        this.url = url;
        this.tel = tel;
        this.mail = mail;
        this.code = code;
        this.image = image;

        this.key = attributeKey;
        this.name = displayName;
    }

    getValue(attributes) {
        var value = attributes[this.key];
        if (Array.isArray(value) && value.length == 0) {
            return null;
        } else if (!value) {
            return null;
        }

        if (this.code) {
            value = layersDefinition[value]["Name (EN)"];
        }
        return value;
    }

    _formatValueNodeFromAttributes(attributes) {
        const value = this.getValue(attributes);
        if (!value) {
            return null;
        }

        var node;
        if (this.url) {
            node = document.createElement("a");
            node.href = `${value}`;
            node.appendChild(document.createTextNode(value));
        } else if (this.tel) {
            node = document.createElement("a");
            node.href = `tel:${value}`;
            node.appendChild(document.createTextNode(value));
        } else if (this.mail) {
            node = document.createElement("a");
            node.href = `mailto:${value}`;
            node.appendChild(document.createTextNode(value));
        } else if (this.code) {
            node = document.createTextNode(value);
        } else if (this.image) {
            node = document.createElement("img");
            node.src = `/assets/threejs/images/${value}`;
            node.setAttribute("width", "100%");
        } else {
            node = document.createTextNode(value);
        }
        return node;
    }

    formatNodeFromAttributes(attributes) {
        const attributeName = this.name;
        const attributeValue = this._formatValueNodeFromAttributes(attributes);

        // Return nothing if the value is null
        if (!attributeValue) { return }

        var div = document.createElement("div");
        div.className = "info-pane-row";

        if (attributeName) {
            var label_span = document.createElement("span");
            label_span.className = "info-pane-label";
            label_span.appendChild(document.createTextNode(attributeName));
            div.appendChild(label_span);
        }

        var value_span = document.createElement("span");
        value_span.className = "info-pane-value";
        value_span.appendChild(attributeValue);
        div.appendChild(value_span);

        return div;
    }

}

class EntryGroup {

    /**
     *
     * @param {String} name
     * @param {Entry[]} entries
     * @param {Boolean} open
     */
    constructor(name, entries, open = false) {
        this.name = name;
        this.entries = entries;
        this.open = open;
    }

    formatNodeFromAttributes(attributes) {
        // Check if any of the attributes exist before creating the section, otherwise do not include
        const hasData = this.entries.some(entry => {
            const value = attributes[entry.key];
            if (Array.isArray(value)) {
                return value.length > 0;
            } else {
                return value;
            }
        });
        if (!hasData) return;

        let details = document.createElement("details");
        details.open = this.open;

        let summary = document.createElement("summary");
        let summarySpan = document.createElement("span");
        summarySpan.className = "info-pane-label";
        summarySpan.appendChild(document.createTextNode(this.name));
        summary.appendChild(summarySpan);

        details.appendChild(summary);

        this.entries.forEach((entry) => {
            const formattedEntry = entry.formatNodeFromAttributes(attributes);
            if (!formattedEntry) return;

            details.appendChild(formattedEntry);
        });

        return details;
    }

}

function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}


/**
 * InfoPane class - handles all info pane UI logic
 */
export class InfoPane {

    /**
     *
     * @param {HTMLElement} paneElement
     * @param {ObjectPicker} picker
     * @param {CjHelper} cjHelper
     */
    constructor(paneElement, picker, cjHelper) {
        this.pane = paneElement;
        this.picker = picker;
        this.cjHelper = cjHelper;
        this.key;

        this._loadInfoPaneHierarchy();

        this._addEventListeners();
    }

    _addEventListeners() {
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
    }

    _loadInfoPaneHierarchy() {
        this.hierarchy = {}

        for (const [cjType, hierarchyInfo] of Object.entries(infoPaneHierarchy)) {
            const title = hierarchyInfo["title"].map((titleOption) => {
                return new Entry(titleOption.key, null, titleOption.options || {});
            });
            var titleNumber = null;
            if (Object.keys(hierarchyInfo).includes("title_number")) {
                titleNumber = hierarchyInfo["title_number"].map((titleOption) => {
                    return new Entry(titleOption.key, null, titleOption.options || {});
                });
            }

            const currentHierarchy = hierarchyInfo["rows"].map((row) => {
                if (row.type === 'entry') {
                    return new Entry(row.key, row.label, row.options || {});
                }
                if (row.type === 'group') {
                    const entries = row.entries.map(e =>
                        new Entry(e.key, e.label, e.options || {})
                    );
                    return new EntryGroup(row.title, entries, row.expanded);
                }
                // Unknown type
                console.warn('Unknown row type', row);
                return null;
            }).filter(Boolean);
            this.hierarchy[cjType] = {
                "title": title,
                "titleNumber": titleNumber,
                "rows": currentHierarchy
            };
        }
    }


    // /**
    //  * Extract building data from CityJSON based on object name
    //  */
    // _getBuildingDataFromName(objectName) {
    //     if (!objectName) return null;

    //     // Remove the LOD suffix (e.g., "-lod_2", "-lod_0")
    //     const cleanName = objectName.replace(/-lod_\d+$/, '');

    //     // Look up in CityJSON
    //     const cityObjects = cityjson.CityObjects;

    //     if (cityObjects && cityObjects[cleanName]) {
    //         const buildingData = cityObjects[cleanName];

    //         // Extract useful attributes
    //         const attrs = buildingData.attributes || {};

    //         return {
    //             name: attrs["Name"] || attrs["Name (EN)"] || layers_definition_json[attrs["code"]]["Name (EN)"],
    //             nameNL: attrs["Name (NL)"],
    //             nicknames: attrs.Nicknames ? attrs.Nicknames.join(", ") : undefined,
    //             address: attrs.Address,
    //         };
    //     }

    //     return null;
    // }

    // _getBuildingDataFromName_alt(objectName) {
    //     if (!objectName) return null;

    //     // Remove the LOD suffix (e.g., "-lod_2", "-lod_0")
    //     const cleanName = objectName.replace(/-lod_\d+$/, '');

    //     // Look up in CityJSON
    //     const cityObjects = cityjson.CityObjects;

    //     if (cityObjects && cityObjects[cleanName]) {
    //         const buildingData = cityObjects[cleanName];

    //         return buildingData;
    //     }

    //     return null;
    // }

    // /**
    //  * Show info for a picked object
    //  */
    // show(key) {
    //     const alt = true;
    //     this.key = key;

    //     if (alt) {
    //         this.show_alt(key);
    //         return;
    //     }

    //     const attributes = this.cjHelper.getAttributes(key);
    //     console.log(attributes);

    //     // Extract building name/title if it exists
    //     const title = attributes["Name (EN)"] || 'No name'
    //     // const title = data.name || data.buildingName || data.title || data["Name (EN)"] || 'Building Information';

    //     // Create structured HTML
    //     let html = `
    //         <div class="info-pane-header">
    //             <h3 class="info-pane-title">${title}</h3>
    //             <button class="info-pane-close" aria-label="Close">&times;</button>
    //         </div>
    //         <div class="info-pane-content">
    //     `;

    //     // Define which keys to exclude and which to prioritize
    //     // const excludeKeys = [
    //     //     'name', 'buildingName', 'title', 'Name (EN)', 'key', 'icon_position',
    //     //     'Skip', '3D BAG Buildings IDs', 'bagIds', 'buildingType'
    //     // ];
    //     const excludeKeys = [
    //         'key',
    //         'Name (EN)',
    //         'icon_position',
    //         'parent_units',
    //         'Skip',
    //         '3D BAG Buildings IDs',
    //         'Color_class',
    //     ];


    //     // Priority fields to show first (in order)
    //     const priorityFields = [
    //         { key: 'Category', label: 'Category' },
    //         { key: 'space_id', label: 'Official code' },
    //         { key: 'ShortName (EN)', label: 'Short name' },
    //         { key: 'Name (NL)', label: 'Dutch name' },
    //         { key: 'Nicknames', label: 'Nicknames' },
    //         { key: 'Address', label: 'Address' },
    //         { key: 'Phone number', label: 'Phone number' },
    //         { key: 'Email', label: 'Email' },
    //         { key: 'TU Delft page (EN)', label: 'TU Delft page (EN)' }
    //     ];

    //     // Add priority fields first
    //     priorityFields.forEach(({ key, label }) => {
    //         const val = attributes[key];

    //         if (![undefined, null, ""].includes(val) && !(Array.isArray(val) && val.length == 0)) {
    //             console.log(Array.isArray(val))
    //             console.log(val);
    //             html += `
    //                 <div class="info-pane-row">
    //                     <span class="info-pane-label">${label}:</span>
    //                     <span class="info-pane-value">${val}</span>
    //                 </div>
    //             `;
    //         }
    //     });

    //     // Add other fields
    //     const entries = Object.entries(attributes).filter(([k]) =>
    //         !excludeKeys.includes(k) &&
    //         !priorityFields.some(pf => pf.key === k)
    //     );

    //     if (entries.length > 0) {
    //         entries.forEach(([key, value]) => {
    //             // Skip if value is undefined, null, empty string, or empty array
    //             if (value === undefined || value === null || value === '' ||
    //                 (Array.isArray(value) && value.length === 0)) {
    //                 return;
    //             }

    //             const formattedKey = key
    //                 .replace(/([A-Z])/g, ' $1')
    //                 .replace(/^./, str => str.toUpperCase())
    //                 .trim();

    //             // Format arrays nicely
    //             const displayValue = Array.isArray(value) ? value.join(', ') : value;

    //             html += `
    //                 <div class="info-pane-row">
    //                     <span class="info-pane-label">${formattedKey}:</span>
    //                     <span class="info-pane-value">${displayValue}</span>
    //                 </div>
    //             `;
    //         });
    //     }

    //     html += `</div>`;

    //     // Add floor plan button if buildingView is available
    //     if (this.picker) {
    //         html += `
    //             <div class="info-pane-footer">
    //                 <button class="info-pane-floorplan-btn" id="info-pane-floorplan-btn">
    //                     <i class="fa-solid fa-layer-group"></i>
    //                     View Floorplan
    //                 </button>
    //             </div>
    //         `;
    //     }

    //     this.pane.innerHTML = html;
    //     this.pane.style.opacity = '1';
    //     this.pane.style.display = 'block'; // Keep it always visible, even with no info

    //     this._attachEventListeners();
    // }

    show(key) {
        this.key = key;

        const attributes = this.cjHelper.getAttributes(key);
        const objectType = this.cjHelper.getType(key);

        // Reset the info pane
        this.pane.innerHTML = "";

        // Make it visible
        this.pane.style.opacity = '1';
        this.pane.style.display = 'block'; // Keep it always visible, even with no info

        if (!Object.keys(this.hierarchy).includes(objectType)) {
            console.error("Unsupported type for the info pane:", objectType)
            this.hide();
            return;
        }

        const hierarchy = this.hierarchy[objectType];

        // Make the title with the space id if there is one
        var title;
        const titleOptions = hierarchy["title"];
        for (const titleOption of titleOptions) {
            const potentialTitle = titleOption.getValue(attributes);
            if (potentialTitle) {
                title = potentialTitle;
                break;
            }
        }
        const titleNumberOptions = hierarchy["titleNumber"];
        if (titleNumberOptions) {
            for (const titleNumberOption of titleNumberOptions) {
                const potentialTitleNumber = titleNumberOption.getValue(attributes);
                if (potentialTitleNumber) {
                    if (title) {
                        title += ` (${potentialTitleNumber})`;
                    } else {
                        title = potentialTitleNumber;
                    }
                    break;
                }
            }
        }

        const infoPaneDefinition = hierarchy["rows"]

        this._addTitle(title);

        // Create content container
        let content_div = document.createElement("div");
        content_div.className = "info-pane-content";
        this.pane.appendChild(content_div);

        for (const row of infoPaneDefinition) {
            const formattedNode = row.formatNodeFromAttributes(attributes);
            if (!formattedNode) { continue }
            this.pane.appendChild(formattedNode);
        }

        this._addFloorPlanButton(key);

        // Add the extra buttons
        this._addInfoPaneExtraButtons(title);
    }


    _addTitle(title) {

        let div = document.createElement("div");
        div.className = "info-pane-header";

        let h3 = document.createElement("h3");
        h3.className = "info-pane-title";
        h3.appendChild(document.createTextNode(title));
        div.appendChild(h3);

        let close_button = document.createElement("button");

        close_button.className = "info-pane-close"
        close_button["aria-label"] = "Close";
        close_button.value = "&times";
        close_button.appendChild(document.createTextNode("x"));

        close_button.addEventListener('click', () => this.picker.closeInfoPane());
        div.appendChild(close_button);


        this.pane.appendChild(div);
    }

    // _add_infoPane_object(attribute_value, attribute_name, container = null) {

    //     let div = document.createElement("div");
    //     div.className = "info-pane-row";


    //     let label_span = document.createElement("span");
    //     label_span.className = "info-pane-label";
    //     label_span.appendChild(document.createTextNode(attribute_name));


    //     let value_span = document.createElement("span");
    //     value_span.className = "info-pane-value";

    //     // Check if it's a phone number or email and make it clickable
    //     if (attribute_name === "Phone number") {
    //         let link = document.createElement("a");
    //         link.href = `tel:${attribute_value}`;
    //         link.appendChild(document.createTextNode(attribute_value));
    //         value_span.appendChild(link);
    //     } else if (attribute_name === "Email") {
    //         let link = document.createElement("a");
    //         link.href = `mailto:${attribute_value}`;
    //         link.appendChild(document.createTextNode(attribute_value));
    //         value_span.appendChild(link);
    //     } else {
    //         value_span.appendChild(document.createTextNode(attribute_value));
    //     }


    //     div.appendChild(label_span);
    //     div.appendChild(value_span);

    //     const target = container || this.pane;
    //     target.appendChild(div);

    // }


    // /**
    //  * Add a collapsible details section with configurable options
    //  * @param {Object} attributes - The building JSON attributes
    //  * @param {string} title - Title of the details element
    //  * @param {Object} config - Configuration object
    //  * @param {Array<string>} config.attributeNames - Array of the underlying attributes
    //  * @param {boolean} config.open - Whether the details should be open by default, the default is false
    //  * @param {HTMLElement} container - Optional container element to append to
    //  */
    // _add_infoPane_details_section(attributes, title, config, container = null) {
    //     const {
    //         attributeNames,
    //         open = false,
    //         // labelTransform = null
    //     } = config;

    //     // Check if any of the attributes exist before creating the section, otherwise do not include
    //     const hasData = Object.keys(attributeNames).some(attr => attributes[attr]);
    //     if (!hasData) return;

    //     let details = document.createElement("details");
    //     details.open = open;

    //     let summary = document.createElement("summary");
    //     let summary_span = document.createElement("span");
    //     summary_span.className = "info-pane-label";
    //     summary_span.appendChild(document.createTextNode(title));
    //     summary.appendChild(summary_span);

    //     details.appendChild(summary);

    //     Object.entries(attributeNames).forEach(([attributeKey, attributeName]) => {
    //         console.log("attributeKey", attributeKey);
    //         console.log("attributeName", attributeName);
    //         const attributeValue = attributes[attributeKey];

    //         // Skip if attribute doesn't exist or is empty
    //         if (!attributeValue) return;

    //         // // Transform the label if a transform function is provided, e.g. "Opening hours (Monday)" -> "Monday"
    //         // const display_label = labelTransform
    //         //     ? labelTransform(attributeName)
    //         //     : attributeName;

    //         let div = document.createElement("div");
    //         div.className = "info-pane-row";

    //         let label_span = document.createElement("span");
    //         label_span.className = "info-pane-label";
    //         label_span.appendChild(document.createTextNode(attributeName));

    //         let value_span = document.createElement("span");
    //         value_span.className = "info-pane-value";
    //         value_span.appendChild(document.createTextNode(attributeValue));

    //         div.appendChild(label_span);
    //         div.appendChild(value_span);

    //         details.appendChild(div);
    //     });

    //     const target = container || this.pane;
    //     target.appendChild(details);
    // }


    _addFloorPlanButton(key) {
        if (!this.cjHelper.isBuilding(key)) { return }
        if (!this.cjHelper.buildingHasFloorPlan(key)) { return }

        let div = document.createElement("div");
        div.className = "info-pane-button-background";

        let button = document.createElement("button");
        button.className = "info-pane-button";

        let button_icon = document.createElement("i");
        button_icon.className = "fa-solid fa-layer-group";

        button.appendChild(button_icon);
        button.appendChild(document.createTextNode("View Floorplan"));

        button.addEventListener('click', (event) => {

            console.log("pressed button");

            if (this.picker) {

                console.log("Button clicked");

                this.picker.switchBuildingView();
            }
        });

        div.appendChild(button);
        this.pane.appendChild(div);

    }

    _addInfoPaneExtraButtons(feedbackLocation) {

        // Container for the buttons
        let div = document.createElement("div");
        div.className = "info-pane-button-background";
        div.classList.add("info-pane-row");

        // Button to report issues
        let reportButtonSpan = document.createElement("span");

        let reportButton = document.createElement("button");
        reportButton.className = "info-pane-button";
        reportButton.append(document.createTextNode("Report an error"));
        reportButton.addEventListener('click', () => {
            // Go to the feedback page with the current location value
            const target = `/feedback.html?location=${feedbackLocation}`;
            window.location.href = target;
        });

        reportButtonSpan.appendChild(reportButton);
        div.appendChild(reportButtonSpan);

        /// Button to book a room
        let bookRoomButtonSpan = document.createElement("span");

        let bookRoomButton = document.createElement("button");
        bookRoomButton.className = "info-pane-button";
        bookRoomButton.append(document.createTextNode("Book a room"));
        bookRoomButton.addEventListener('click', () => {
            const target = `https://spacefinder.tudelft.nl/en/buildings/`;
            window.location.href = target;
        });

        bookRoomButtonSpan.appendChild(bookRoomButton);
        div.appendChild(bookRoomButtonSpan);

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
}