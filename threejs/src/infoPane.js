import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };
import infoPaneHierarchy from "../assets/threejs/buildings/info_pane-hierarchy.json" assert { type: "json" };
import layersDefinition from "../assets/threejs/buildings/thematic_codelist-definition.json" assert { type: "json" };
import allowedUnitOrder from "../assets/threejs/buildings/children_units-order.json" assert { type: "json" };

import { CjHelper } from "./cjHelper";
import { ObjectPicker } from "./objectPicker";

class Entry {
    constructor(
        keyOrElse = { key: null, value: null, object: null },
        displayName,
        config = {
            url: false,
            tel: false,
            mail: false,
            code: false,
            image: false,
        }
    ) {
        const { key, value, object } = keyOrElse;
        const { url, tel, mail, code, image } = config;

        // The Entry cannot be two of url, tel, mail, code or image at the same time
        const numberTrue = [url, tel, mail, code, image].filter(Boolean).length;
        if (numberTrue > 1) {
            console.error("Cannot have multiple config properties.");
            return;
        }

        // The Entry cannot be two of key, value or object at the same time
        const numberTrueKeyValue = [key, value, object].filter(Boolean).length;
        if (numberTrueKeyValue > 1) {
            console.error("Cannot have two of key, value and object.");
            return;
        }

        this.url = url;
        this.tel = tel;
        this.mail = mail;
        this.code = code;
        this.image = image;

        this.key = key;
        this.value = value;
        this.object = object;

        this.name = displayName;
    }

    /**
     *
     * @param {InfoPane} infoPane
     * @param {string} key
     * @returns
     */
    getValue(infoPane, key) {
        if (this.value) {
            return this.value;
        } else if (this.object) {
            return this.object;
        }

        const attributes = infoPane.cjHelper.getAttributes(key);
        var value = attributes[this.key];
        if (Array.isArray(value)) {
            if (value.length == 0) {
                value = null;
            } else {
                value = value.join(", ");
            }
        } else if (!value) {
            value = null;
        }

        if (this.code) {
            value = layersDefinition[value]["Name (EN)"];
        }
        return value;
    }

    /**
     *
     * @param {InfoPane} infoPane
     * @param {string} key
     * @returns
     */
    _formatValueNodeFromAttributes(infoPane, key) {
        const value = this.getValue(infoPane, key);
        if (!value) {
            return null;
        } else if (this.object) {
            var node = null;
            if (this.object == "ParentBuilding") {
                const parentBuildingObjectKey =
                    infoPane.cjHelper.findParentBuildingObjectKey(key);
                const buildingTitle = infoPane._makeTitle(
                    parentBuildingObjectKey
                );

                // Group of buttons
                node = document.createElement("div");
                node.className = "info-pane-buttons-group";

                // Button
                const buildingButton = document.createElement("button");
                buildingButton.className = "info-pane-button-part";
                buildingButton.onclick = () => {
                    infoPane.picker.pickMesh(parentBuildingObjectKey);
                };
                buildingButton.appendChild(
                    document.createTextNode(buildingTitle)
                );
                node.appendChild(buildingButton);
            } else if (this.object == "ChildrenUnits") {
                if (!infoPane.cjHelper.isBuilding(key)) {
                    const objectType = infoPane.cjHelper.getType(key);
                    console.error(
                        `Support for ChildrenUnits is not supported yet for '${objectType}'.`
                    );
                    return;
                }
                const unitGroupsKeys =
                    infoPane.cjHelper.getBuildingUnitGroupsObjectKeys(key);
                const unitCodes = unitGroupsKeys.map((unitGroupKey) => {
                    const attributes =
                        infoPane.cjHelper.getAttributes(unitGroupKey);
                    return attributes["code"];
                });

                // Instead of inserting all icons in arbitrary order, insert only those, in order, that are present in the JSON
                const icons = [];
                allowedUnitOrder.forEach((allowedName) => {
                    unitCodes.forEach((unitCode) => {
                        const unitDef = layersDefinition[unitCode];
                        if (!unitDef) return;
                        const iconName = unitDef["Name (EN)"];
                        if (iconName !== allowedName) return;
                        const iconFile = unitDef["Icon name"];
                        if (!iconFile) return;
                        const iconPath = `../assets/threejs/graphics/icons/thematic-layers/${iconFile}`;
                        const img = document.createElement("img");
                        img.className = "icon";
                        img.setAttribute("alt", iconName);
                        img.setAttribute("title", iconName);
                        img.setAttribute("width", "35px");
                        img.src = iconPath;
                        icons.push(img);
                    });
                });
                if (icons.length == 0) {
                    return null;
                }
                node = document.createElement("a");
                icons.forEach((icon) => {
                    node.appendChild(icon);
                });
            } else if (this.object == "RoomUnits") {
                if (!infoPane.cjHelper.isBuildingRoom(key)) {
                    const objectType = infoPane.cjHelper.getType(key);
                    console.error(
                        `Support for RoomUnits is not supported yet for '${objectType}'.`
                    );
                    return;
                }
                const roomAttributes = infoPane.cjHelper.getAttributes(key);
                const unitsKeys = roomAttributes["parent_units"];
                if (unitsKeys.length == 0) {
                    return null;
                }

                // Group of buttons
                node = document.createElement("div");
                node.className = "info-pane-buttons-group";

                // Add all unit buttons
                unitsKeys.forEach((unitKey) => {
                    const unitTitle = infoPane._makeTitle(unitKey);
                    const unitButton = document.createElement("button");
                    unitButton.className = "info-pane-button-part";
                    unitButton.onclick = () => {
                        infoPane.picker.pickMesh(unitKey);
                    };
                    unitButton.appendChild(document.createTextNode(unitTitle));
                    node.appendChild(unitButton);
                });
            } else {
                console.error(
                    `Support for object '${this.object}' is not supported yet.`
                );
            }
            return node;
        }

        var node;
        if (this.url) {
            // Group of buttons
            node = document.createElement("div");
            node.className = "info-pane-buttons-group";

            // Button
            const button = document.createElement("button");
            button.className = "info-pane-button-part";
            button.onclick = () => {
                window.location.href = `${value}`;
            };
            button.appendChild(document.createTextNode(this.name));

            node.appendChild(button);
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

    /**
     *
     * @param {InfoPane} infoPane
     * @param {string} key
     * @param {boolean} inGroup
     * @returns
     */
    formatNodeFromAttributes(infoPane, key, inGroup = false) {
        var attributeName = this.name;
        const attributeValue = this._formatValueNodeFromAttributes(
            infoPane,
            key
        );

        // Return nothing if the value is null
        if (!attributeValue) {
            return;
        }

        var div = document.createElement("div");

        if (this.url) {
            attributeName = null;
        }

        if (inGroup) {
            div.className = "info-pane-row";
        } else {
            div.className = "info-pane-row--compact";
        }

        if (attributeName) {
            var label_span = document.createElement("span");
            label_span.className = "info-pane-label";
            label_span.appendChild(document.createTextNode(attributeName));
            div.appendChild(label_span);
        }

        var value_span = document.createElement("span");
        if (attributeName) {
            value_span.className = "info-pane-value";
        } else {
            value_span.className = "info-pane-value-alone";
        }
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

    /**
     *
     * @param {InfoPane} infoPane
     * @param {string} key
     * @returns
     */
    formatNodeFromAttributes(infoPane, key) {
        const attributes = infoPane.cjHelper.getAttributes(key);
        // Check if any of the attributes exist before creating the section, otherwise do not include
        const hasData = this.entries.some((entry) => {
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
            const formattedEntry = entry.formatNodeFromAttributes(
                infoPane,
                key,
                true
            );
            if (!formattedEntry) return;

            // keep each entry inside the details block
            details.appendChild(formattedEntry);
        });

        return details;
    }
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
        this.hierarchy = {};

        for (const [cjType, hierarchyInfo] of Object.entries(
            infoPaneHierarchy
        )) {
            const title = hierarchyInfo["title"].map((titleOption) => {
                const keyOrValue = {
                    key: titleOption["key"],
                    value: titleOption["value"],
                    object: titleOption["object"],
                };
                return new Entry(keyOrValue, null, titleOption.options || {});
            });
            var titleNumber = null;
            if (Object.keys(hierarchyInfo).includes("title_number")) {
                titleNumber = hierarchyInfo["title_number"].map(
                    (titleOption) => {
                        const keyOrValue = {
                            key: titleOption["key"],
                            value: titleOption["value"],
                            object: titleOption["object"],
                        };
                        return new Entry(
                            keyOrValue,
                            null,
                            titleOption.options || {}
                        );
                    }
                );
            }

            const currentHierarchy = hierarchyInfo["rows"]
                .map((row) => {
                    if (row.type === "entry") {
                        const keyOrValue = {
                            key: row["key"],
                            value: row["value"],
                            object: row["object"],
                        };
                        return new Entry(
                            keyOrValue,
                            row.label,
                            row.options || {}
                        );
                    }
                    if (row.type === "group") {
                        const entries = row.entries.map((e) => {
                            const keyOrValue = {
                                key: e["key"],
                                value: e["value"],
                                object: e["object"],
                            };
                            return new Entry(
                                keyOrValue,
                                e.label,
                                e.options || {}
                            );
                        });
                        return new EntryGroup(row.title, entries, row.expanded);
                    }
                    // Unknown type
                    console.warn("Unknown row type", row);
                    return null;
                })
                .filter(Boolean);
            this.hierarchy[cjType] = {
                title: title,
                titleNumber: titleNumber,
                rows: currentHierarchy,
            };
        }
    }

    show(key) {
        this.key = key;

        // Reset the info pane
        this.pane.innerHTML = "";

        // Make it visible
        // this.pane.style.display = 'block'; // make it present in layout so transitions can run

        if (window.matchMedia("(max-width: 620px)").matches) {
            // mobile sheet behavior: add body class
            document.body.classList.add("info-pane-active-mobile");
            requestAnimationFrame(() => {
                this.pane.classList.add("mobile-open");
                this.pane.style.opacity = "1";
            });
        } else {
            // desktop behavior
            document.body.classList.remove("info-pane-active-mobile");
            this.pane.style.opacity = "1";
            this.pane.classList.remove("mobile-open");
        }

        const objectType = this.cjHelper.getType(key);
        if (!Object.keys(this.hierarchy).includes(objectType)) {
            console.error("Unsupported type for the info pane:", objectType);
            this.hide();
            return;
        }

        const title = this._makeTitle(key);
        this._addTitle(title);

        const hierarchy = this.hierarchy[objectType];
        const infoPaneDefinition = hierarchy["rows"];

        // Create content container
        let content_div = document.createElement("div");
        content_div.className = "info-pane-content";
        this.pane.appendChild(content_div);

        // Prevent mouse wheel / touch scroll events from bubbling to the map behind the pane.
        content_div.addEventListener(
            "wheel",
            (e) => {
                e.stopPropagation();
            },
            { passive: true }
        );

        content_div.addEventListener(
            "pointerdown",
            (e) => {
                e.stopPropagation();
            },
            { passive: true }
        );

        content_div.addEventListener(
            "touchmove",
            (e) => {
                e.stopPropagation();
            },
            { passive: true }
        );

        for (const row of infoPaneDefinition) {
            const formattedNode = row.formatNodeFromAttributes(this, key);
            if (!formattedNode) {
                continue;
            }
            content_div.appendChild(formattedNode);
        }

        this._addFloorPlanButton(key);
        this._addInfoPaneExtraButtons(title);
    }

    /**
     * Make the title with the space id if there is one.
     *
     * @param {string} key
     * @returns
     */
    _makeTitle(key) {
        const objectType = this.cjHelper.getType(key);
        const hierarchy = this.hierarchy[objectType];

        var title;
        const titleOptions = hierarchy["title"];
        for (const titleOption of titleOptions) {
            const potentialTitle = titleOption.getValue(this, key);
            if (potentialTitle) {
                title = potentialTitle;
                break;
            }
        }
        const titleNumberOptions = hierarchy["titleNumber"];
        if (titleNumberOptions) {
            for (const titleNumberOption of titleNumberOptions) {
                const potentialTitleNumber = titleNumberOption.getValue(
                    this,
                    key
                );
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
        return title;
    }

    _addTitle(title) {
        let div = document.createElement("div");
        div.className = "info-pane-header";

        let h3 = document.createElement("h3");
        h3.className = "info-pane-title";
        h3.appendChild(document.createTextNode(title));
        div.appendChild(h3);

        let close_button = document.createElement("button");

        close_button.className = "info-pane-close";
        close_button["aria-label"] = "Close";

        // Use an SVG icon instead of text for the close button
        const closeIconUrl = new URL(
            "../assets/threejs/graphics/icons/ui-buttons/close_icon_white.svg",
            import.meta.url
        ).href;
        let closeImg = document.createElement("img");
        closeImg.src = closeIconUrl;
        closeImg.alt = "Close";
        closeImg.className = "info-pane-close-icon";
        closeImg.width = 20;
        closeImg.height = 20;
        close_button.appendChild(closeImg);

        close_button.addEventListener("click", () => this.hide());
        div.appendChild(close_button);

        this.pane.appendChild(div);
    }

    _addFloorPlanButton(key) {
        if (!this.cjHelper.isBuilding(key)) {
            return;
        }
        if (!this.cjHelper.buildingHasFloorPlan(key)) {
            return;
        }

        let div = document.createElement("div");
        div.className = "info-pane-button-background";

        let button = document.createElement("button");
        button.className = "info-pane-button";

        let button_icon = document.createElement("i");
        button_icon.className = "fa-solid fa-layer-group";

        button.appendChild(button_icon);
        button.appendChild(document.createTextNode("View Floorplan"));

        button.addEventListener("click", (event) => {
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
        reportButton.addEventListener("click", () => {
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
        bookRoomButton.addEventListener("click", () => {
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
        if (this.pane.classList.contains("mobile-open")) {
            this.pane.classList.remove("mobile-open");

            document.body.classList.remove("info-pane-active-mobile");

            // wait for CSS transition to finish before removing content/display
            setTimeout(() => {
                this.pane.style.opacity = "0";
                this.pane.innerHTML = "";
                // this.pane.style.display = 'none';
            }, 320); // slightly longer than CSS transition (260ms)
            return;
        }

        // desktop: hide immediately
        document.body.classList.remove("info-pane-active-mobile");

        this.pane.style.opacity = "0";
        this.pane.innerHTML = "";
        // this.pane.style.display = 'none';
    }
}
