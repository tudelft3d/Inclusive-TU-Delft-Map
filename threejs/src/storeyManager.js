import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import { BuildingView } from "./buildingView";
import { CjHelper } from "./cjHelper";

export class StoreyManager {

    /**
     * 
     * @param {BuildingView} buildingView 
     * @param {CjHelper} cjHelper 
     */
    constructor(buildingView, cjHelper) {
        this.buildingView = buildingView;
        this.cjHelper = cjHelper;

        this.pane = document.getElementById("storey-manager");

        this._add_event_listeners();

        this.controlsDiv = null;
        window.addEventListener('resize', () => this._position_storey_controls());
        window.addEventListener('scroll', () => this._position_storey_controls(), { passive: true });

        this.infoPaneObserver = null;
        this.bodyObserver = null;
    }

    _add_event_listeners() {
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

    _extract_unique_storey_attr(storeys_attributes, attribute_name) {
        const values = storeys_attributes.map((attrs) => { return attrs[attribute_name] });
        const uniqueValues = new Set(values);
        if (uniqueValues.size > 1) {
            console.error("There are more than one value for this attribute for the storey:", attribute_name);
        }
        return uniqueValues.values().next().value;
    }

    activate(building_object_key, storey_code, available_storeys) {
        this.current_storey_code = storey_code;

        this.available_storeys = {};
        const levels = [];
        for (const [storey_code, storey_object_keys] of Object.entries(available_storeys)) {
            // console.log("storey_object_keys", storey_object_keys);
            const storeys_attributes = storey_object_keys.map((key) => { return this.cjHelper.getAttributes(key) });

            // Extract the attributes
            const name = this._extract_unique_storey_attr(storeys_attributes, "Name (EN)");
            const displayedPrefix = this._extract_unique_storey_attr(storeys_attributes, "Storey Prefix");
            const level = this._extract_unique_storey_attr(storeys_attributes, "storey_level");

            this.available_storeys[storey_code] = { name, displayedPrefix, level };
            levels.push(level);
        }

        // Order the storeys (descending: highest floor first)
        levels.sort((a, b) => b - a);
        this.order_to_storey_code = Array(Object.keys(this.available_storeys).length);
        for (const [storey_code, storey_data] of Object.entries(this.available_storeys)) {
            const level = storey_data.level;
            const order = levels.indexOf(level)
            this.available_storeys[storey_code].order = order;
            this.order_to_storey_code[order] = storey_code
        }

        this._create_storey_manager(building_object_key);
    }

    deactivate() {

        this.pane.innerHTML = "";

        this.pane.style.opacity = '0';
        this.pane.style.display = 'none';

        if (this.controlsDiv) {
            this.controlsDiv.innerHTML = "";
            this.controlsDiv.style.display = 'none';
        }

        if (this.infoPaneObserver) {
            this.infoPaneObserver.disconnect();
            this.infoPaneObserver = null;
        }
        if (this.bodyObserver) {
            this.bodyObserver.disconnect();
            this.bodyObserver = null;
        }

    }

    setStorey(storey) {
        if (this.current_storey_code == storey) {
            return;
        }
        this.current_storey_code = storey;
        this.storey_code_to_opt[this.current_storey_code].selected = true;
    }

    _create_storey_manager(buildingObjectKey) {

        this.pane.innerHTML = "";

        this.pane.style.opacity = '1';
        this.pane.style.display = 'block';

        if (!this.controlsDiv) {
            this.controlsDiv = document.createElement("div");
            this.controlsDiv.className = "storey-controls";
            document.body.appendChild(this.controlsDiv);
        }

        this.controlsDiv.innerHTML = "";
        this.controlsDiv.style.display = ""; // allow CSS to control visibility
        const controls_div = this.controlsDiv;

        let left_col = document.createElement("div");
        left_col.className = "storey-controls-left";

        let right_col = document.createElement("div");
        right_col.className = "storey-controls-right";

        controls_div.appendChild(left_col);
        controls_div.appendChild(right_col);

        let exit_span = document.createElement("span");
        left_col.appendChild(exit_span);

        let exit_button = document.createElement("button");
        exit_button.className = "storey-exit-btn";
        exit_button.type = "button";
        exit_button.setAttribute("data-tooltip-right", "Exit the floor plan");
        let exit_img = document.createElement("img");
        exit_img.src = "../assets/threejs/graphics/icons/ui-buttons/close_icon_white.svg";
        exit_img.alt = "";
        exit_button.appendChild(exit_img);

        exit_button.addEventListener("click", (event) => {
            event.stopPropagation();
            if (this.buildingView && this.buildingView.picker && typeof this.buildingView.picker.switchBuildingView === "function") {
                this.buildingView.picker.switchBuildingView();
            }

            this.deactivate();
        });

        exit_span.appendChild(exit_button);


        let drop_down_span = document.createElement("span");
        right_col.appendChild(drop_down_span);

        // use a native <select> populated from available storeys (ordered)
        this.select = document.createElement("select");
        this.select.id = "storey-select";
        this.select.className = "storey-select";

        // populate options in visual order
        this.storey_code_to_opt = {};
        this.order_to_storey_code.forEach((storey_code) => {
            const info = this.available_storeys[storey_code];
            const label = info.name + ` (${info.displayedPrefix})`;
            let opt = document.createElement("option");
            opt.value = storey_code;
            opt.text = label;
            this.storey_code_to_opt[storey_code] = opt;
            if (storey_code === this.current_storey_code) opt.selected = true;
            this.select.appendChild(opt);
        });

        this.select.addEventListener("change", (e) => {
            const selected = e.target.value;
            this.current_storey_code = selected;
            this.buildingView.setStorey(selected);
        });

        drop_down_span.appendChild(this.select);


        let arrow_span = document.createElement("span");
        left_col.appendChild(arrow_span);

        // vertical split button 
        let arrow_button_div = document.createElement("div");
        arrow_button_div.className = "storey-vertical-button";
        arrow_span.appendChild(arrow_button_div);

        let up_half = document.createElement("button");
        up_half.className = "storey-vertical-half up";
        up_half.type = "button";
        up_half.setAttribute("data-tooltip-right", "Move up a floor");
        up_half.addEventListener("click", (event) => {
            this._go_up_one_storey();
        });

        let down_half = document.createElement("button");
        down_half.className = "storey-vertical-half down";
        down_half.type = "button";
        down_half.setAttribute("data-tooltip-right", "Move down a floor");
        down_half.addEventListener("click", (event) => {
            this._go_down_one_storey();
        });

        arrow_button_div.appendChild(up_half);
        arrow_button_div.appendChild(down_half);
        this._position_storey_controls();

        this._ensure_info_pane_observers();
    }

    _go_up_one_storey() {
        const current_order = this.available_storeys[this.current_storey_code].order;
        var next_order = current_order - 1;
        if (next_order < 0) {
            next_order = current_order;
        }
        this.current_storey_code = this.order_to_storey_code[next_order];

        this.buildingView.setStorey(this.current_storey_code);
        this.storey_code_to_opt[this.current_storey_code].selected = true;
    }

    _go_down_one_storey() {
        const current_order = this.available_storeys[this.current_storey_code].order;
        var next_order = current_order + 1;
        if (next_order > this.order_to_storey_code.length - 1) {
            next_order = current_order;
        }
        this.current_storey_code = this.order_to_storey_code[next_order];

        this.buildingView.setStorey(this.current_storey_code);
        this.storey_code_to_opt[this.current_storey_code].selected = true;
    }

    _populate_storey_dropdown() {

        let div = document.getElementById("storey_manager_dropdown");

        if (div.innerHTML != "") {
            div.innerHTML = "";
            return;
        }

        this.order_to_storey_code.forEach((storey_code) => {
            const storey_info = this.available_storeys[storey_code];
            const storey_name = storey_info.name + ` (${storey_info.displayedPrefix})`;

            let button_div = document.createElement("div");
            button_div.className = "storey-manager-dropdown-element";
            div.appendChild(button_div);

            let code_button = document.createElement("button");
            code_button.appendChild(document.createTextNode(storey_name));
            button_div.appendChild(code_button);

            code_button.addEventListener("click", (event) => {

                this.buildingView.setStorey(storey_code);

            });

        });

    }

    _position_storey_controls() {
        const c = this.controlsDiv;
        if (!c) return;

        const infoPane = document.getElementById('info-pane');
        const paneExists = !!infoPane;
        const paneVisible = paneExists && window.getComputedStyle(infoPane).display !== 'none' && window.getComputedStyle(infoPane).visibility !== 'hidden' && infoPane.offsetParent !== null;

        if (paneVisible) {
            if (c.parentElement !== infoPane) {
                infoPane.appendChild(c);
            }
            c.classList.add('storey-controls--attached');
            c.style.display = '';
        } else {
            if (c.parentElement !== document.body) {
                document.body.appendChild(c);
            }
            c.classList.remove('storey-controls--attached');
            c.style.display = '';
        }
    }

    _ensure_info_pane_observers() {
        const infoPane = document.getElementById('info-pane');

        if (infoPane && !this.infoPaneObserver) {
            this.infoPaneObserver = new MutationObserver(() => this._position_storey_controls());
            this.infoPaneObserver.observe(infoPane, { attributes: true, attributeFilter: ['style', 'class'] });
        }

        if (!this.bodyObserver) {
            this.bodyObserver = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type === 'childList') {
                        const hasInfoPane = !!document.getElementById('info-pane');
                        if (hasInfoPane) {
                            if (this.infoPaneObserver) {
                                this.infoPaneObserver.disconnect();
                                this.infoPaneObserver = null;
                            }
                            this._position_storey_controls();
                            const newPane = document.getElementById('info-pane');
                            if (newPane) {
                                this.infoPaneObserver = new MutationObserver(() => this._position_storey_controls());
                                this.infoPaneObserver.observe(newPane, { attributes: true, attributeFilter: ['style', 'class'] });
                            }
                        } else {
                            this._position_storey_controls();
                        }
                        break;
                    }
                }
            });
            this.bodyObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

}