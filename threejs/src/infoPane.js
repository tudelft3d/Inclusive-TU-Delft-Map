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

        // make Category and Address rows use a more compact padding
        if (attributeName === "Address" || attributeName === "Category") {
            div.classList.add("info-pane-row--compact");
        }
        
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

        // add a class so we can style the details/summary and chevron
        let details = document.createElement("details");
        details.className = "info-pane-group";
        details.open = this.open;

        let summary = document.createElement("summary");
        summary.className = "info-pane-group-title";

        let summarySpan = document.createElement("span");
        summarySpan.className = "info-pane-label";
        summarySpan.appendChild(document.createTextNode(this.name));
        summary.appendChild(summarySpan);

        details.appendChild(summary);

        this.entries.forEach((entry) => {
            const formattedEntry = entry.formatNodeFromAttributes(attributes);
            if (!formattedEntry) return;

            // keep each entry inside the details block
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

       // overlay removed — mobile will use full-screen sheet and doesn't need a dim overlay
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
                "rows": currentHierarchy
            };
        }
    }
    show(key) {
        this.key = key;

        // put pane above other UI
        if (this.pane) {
            this.pane.style.zIndex = '2501';
        }

        const attributes = this.cjHelper.getAttributes(key);
        const objectType = this.cjHelper.getType(key);

        // Reset the info pane
        this.pane.innerHTML = "";

        // Make it visible
        this.pane.style.display = 'block'; // make it present in layout so transitions can run

        if (window.matchMedia('(max-width: 620px)').matches) {
            // mobile sheet behavior: add body class
            document.body.classList.add('info-pane-active-mobile');
            requestAnimationFrame(() => {
                this.pane.classList.add('mobile-open');
                this.pane.style.opacity = '1';
            });
        } else {
            // desktop behavior
            document.body.classList.remove('info-pane-active-mobile');
            this.pane.style.opacity = '1';
            this.pane.classList.remove('mobile-open');
        }

        if (!Object.keys(this.hierarchy).includes(objectType)) {
            console.error("Unsupported type for the info pane:", objectType)
            this.hide();
            return;
        }

        const hierarchy = this.hierarchy[objectType];

        // Make the title with the space id if there is one
        const titleOptions = hierarchy["title"];
        var title;
        for (const titleOption of titleOptions) {
            const potentialTitle = titleOption.getValue(attributes);
            if (potentialTitle) {
                title = potentialTitle;
                break;
            }
        }
        const spaceId = this.cjHelper.getSpaceId(key);
        if (spaceId) {
            title = title + ` (${spaceId})`
        }
        const infoPaneDefinition = hierarchy["rows"]

        this._addTitle(title);

        // Create content container
        let content_div = document.createElement("div");
        content_div.className = "info-pane-content";
        this.pane.appendChild(content_div);

        // Prevent mouse wheel / touch scroll events from bubbling to the map behind the pane.
        content_div.addEventListener('wheel', (e) => {
            e.stopPropagation();
        }, { passive: true });

        content_div.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        }, { passive: true });

        content_div.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });

        for (const row of infoPaneDefinition) {
            const formattedNode = row.formatNodeFromAttributes(attributes);
            if (!formattedNode) { continue }
            content_div.appendChild(formattedNode);
        }

        this._addFloorPlanButton(key);
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

        // Use an SVG icon instead of text for the close button
        const closeIconUrl = new URL("../assets/threejs/graphics/icons/ui-buttons/close_icon_white.svg", import.meta.url).href;
        let closeImg = document.createElement("img");
        closeImg.src = closeIconUrl;
        closeImg.alt = "Close";
        closeImg.className = "info-pane-close-icon";
        closeImg.width = 20;
        closeImg.height = 20;
        close_button.appendChild(closeImg);

        close_button.addEventListener('click', () => this.picker.closeInfoPane());
        div.appendChild(close_button);

        this.pane.appendChild(div);
    }

    _addFloorPlanButton(key) {
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
        // If mobile sheet is open, remove the class so CSS animates it down, then clear after transition
        if (this.pane.classList.contains('mobile-open')) {
            this.pane.classList.remove('mobile-open');

            document.body.classList.remove('info-pane-active-mobile');

            // wait for CSS transition to finish before removing content/display
            setTimeout(() => {
                this.pane.style.opacity = '0';
                this.pane.innerHTML = '';
                this.pane.style.display = 'none';
            }, 320); // slightly longer than CSS transition (260ms)
            return;
        }

        // desktop: hide immediately
        document.body.classList.remove('info-pane-active-mobile');

        this.pane.style.opacity = '0';
        this.pane.innerHTML = '';
        this.pane.style.display = 'none';
    }
}