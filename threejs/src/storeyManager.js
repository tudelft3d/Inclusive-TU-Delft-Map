import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export class StoreyManager {
    constructor(buildingView) {

        this.pane = document.getElementById("storey-manager");

        this.buildingView = buildingView;

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

    activate(building_object_key, storey_code, available_storeys) {

        this.current_storey = storey_code;
        this.available_storeys = available_storeys;

        this._create_storey_manager(building_object_key);

    }

    deactivate() {

        this.pane.innerHTML = "";

        this.pane.style.opacity = '0';
        this.pane.style.display = 'none';

    }

    _create_storey_manager(buildingObjectKey) {

        console.log(this.pane);

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

            this.buildingView.deactivate();
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

        let arrow_button_div = document.createElement("div");
        arrow_span.appendChild(arrow_button_div);

        let up_arrow_button = document.createElement("button");
        up_arrow_button.append(document.createTextNode("Go Up"));

        up_arrow_button.addEventListener("click", (event) => {
            this._go_up_one_storey();
        });

        let down_arrow_button = document.createElement("button");
        down_arrow_button.append(document.createTextNode("Go Down"));

        down_arrow_button.addEventListener("click", (event) => {
            this._go_down_one_storey();
        });

        arrow_button_div.appendChild(up_arrow_button);
        arrow_button_div.appendChild(down_arrow_button);


    }

    _go_up_one_storey() {

        const current_index = this.available_storeys.indexOf(this.current_storey);

        if (current_index + 1 == this.available_storeys.length) {
            return;
        }

        const new_storey = this.available_storeys[current_index + 1];

        this.current_storey = new_storey;

        this.buildingView.setStorey(new_storey);

    }

    _go_down_one_storey() {

        const current_index = this.available_storeys.indexOf(this.current_storey);

        if (current_index - 1 <= 1) {
            return;
        }

        const new_storey = this.available_storeys[current_index - 1];

        this.current_storey = new_storey;

        this.buildingView.setStorey(new_storey);

    }

    _populate_storey_dropdown() {

        let div = document.getElementById("storey_manager_dropdown");

        if (div.innerHTML != "") {
            div.innerHTML = "";
            return;
        }

        this.available_storeys.forEach((current_storey_code) => {

            let button_div = document.createElement("div");
            button_div.className = "storey-manager-dropdown-element";
            div.appendChild(button_div);

            let code_button = document.createElement("button");
            code_button.appendChild(document.createTextNode("Go to: " + current_storey_code));
            button_div.appendChild(code_button);

            code_button.addEventListener("click", (event) => {

                this.buildingView.setStorey(current_storey_code);

            });

        });

    }

}