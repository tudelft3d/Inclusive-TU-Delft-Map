all_bag_ids = []
with open("../assets/buildings/lars/campus.gltf", "r") as f:
    line = f.readline()
    while line:
        line = f.readline().strip()
        if line.startswith('"name"'):
            value = line.split('"name":')[1].strip().strip(",").strip('"').split("-")[0]
            print(value)
            all_bag_ids.append(value)

with open("all_bag_ids.txt", "w") as f:
    f.write(",".join(all_bag_ids))
