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

        // Order the storeys
        levels.sort();
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

    }

    _create_storey_manager(buildingObjectKey) {

        this.pane.innerHTML = "";

        this.pane.style.opacity = '1';
        this.pane.style.display = 'block';


        let drop_down_element_div = document.createElement("div");
        drop_down_element_div.className = "storey-manager-content";
        drop_down_element_div.id = "storey_manager_dropdown"
        this.pane.appendChild(drop_down_element_div);


        let controls_div = document.createElement("div");
        controls_div.className = "storey-manager-content";
        this.pane.appendChild(controls_div);


        let exit_span = document.createElement("span");
        controls_div.appendChild(exit_span);

        let exit_button = document.createElement("button");
        exit_button.append(document.createTextNode("Exit"));

        exit_button.addEventListener("click", (event) => {

            this.buildingView.picker.switchBuildingView();
            this.deactivate();

        });

        exit_span.appendChild(exit_button);


        let drop_down_span = document.createElement("span");
        controls_div.appendChild(drop_down_span);

        let drop_down_button = document.createElement("button");
        drop_down_button.append(document.createTextNode("Select Storey"));

        drop_down_button.addEventListener("click", (event) => {

            this._populate_storey_dropdown();

        });

        drop_down_span.appendChild(drop_down_button);


        let arrow_span = document.createElement("span");
        controls_div.appendChild(arrow_span);

        // vertical split button 
        let arrow_button_div = document.createElement("div");
        arrow_button_div.className = "storey-vertical-button";
        arrow_span.appendChild(arrow_button_div);

        let up_half = document.createElement("button");
        up_half.className = "storey-vertical-half up";
        up_half.type = "button";
        up_half.addEventListener("click", (event) => {
            this._go_up_one_storey();
        });

        let down_half = document.createElement("button");
        down_half.className = "storey-vertical-half down";
        down_half.type = "button";
        down_half.addEventListener("click", (event) => {
            this._go_down_one_storey();
        });

        arrow_button_div.appendChild(up_half);
        arrow_button_div.appendChild(down_half);


    }

    _go_up_one_storey() {
        const current_order = this.available_storeys[this.current_storey_code].order;
        var next_order = current_order + 1;
        if (next_order > this.order_to_storey_code.length - 1) {
            next_order = current_order;
        }
        this.current_storey_code = this.order_to_storey_code[next_order];

        this.buildingView.setStorey(this.current_storey_code);
    }

    _go_down_one_storey() {
        const current_order = this.available_storeys[this.current_storey_code].order;
        var next_order = current_order - 1;
        if (next_order < 0) {
            next_order = current_order;
        }
        this.current_storey_code = this.order_to_storey_code[next_order];

        this.buildingView.setStorey(this.current_storey_code);
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

}