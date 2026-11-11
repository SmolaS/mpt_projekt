

import cv2
import json

STREAM_URL = "http://192.168.137.105:8080/video"

cap = cv2.VideoCapture(STREAM_URL)

if not cap.isOpened():
    raise RuntimeError("Cannot connect to camera")

# Pobieramy jedną klatkę do kalibracji
ret, frame = cap.read()

cap.release()

if not ret:
    raise RuntimeError("Cannot receive frame")

height, width = frame.shape[:2]

tables = []
points = []
table_id = 1


def mouse_callback(event, x, y, flags, param):
    global points

    if event == cv2.EVENT_LBUTTONDOWN:
        points.append((x, y))


cv2.namedWindow("Table Calibration")
cv2.setMouseCallback("Table Calibration", mouse_callback)

print("TABLE CALIBRATION")
print("Click two opposite corners of each table area.")
print("N - next table")
print("U - undo last point")
print("S - save configuration")
print("Q - quit")


while True:
    display = frame.copy()

    # Draw previously defined tables
    for table in tables:
        x1, y1, x2, y2 = table["roi"]

        cv2.rectangle(
            display,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

        cv2.putText(
            display,
            f"Table {table['id']}",
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

    # Draw currently selected points
    for point in points:
        cv2.circle(display, point, 5, (0, 0, 255), -1)

    if len(points) == 2:
        cv2.rectangle(
            display,
            points[0],
            points[1],
            (0, 0, 255),
            2
        )

    cv2.imshow("Table Calibration", display)

    key = cv2.waitKey(20) & 0xFF

    # Two clicks define one ROI
    if key == ord('n') and len(points) == 2:

        x1, y1 = points[0]
        x2, y2 = points[1]

        # Normalize coordinates
        roi = [
            min(x1, x2),
            min(y1, y2),
            max(x1, x2),
            max(y1, y2)
        ]

        tables.append({
            "id": table_id,
            "roi": roi
        })

        print(f"Table {table_id} added: {roi}")

        table_id += 1
        points = []

    elif key == ord('u'):
        if points:
            points.pop()
        elif tables:
            removed = tables.pop()
            table_id = removed["id"]
            print(f"Removed table {table_id}")

    elif key == ord('s'):

        if not tables:
            print("No tables defined!")
            continue

        # Save normalized coordinates
        normalized_tables = []

        for table in tables:
            x1, y1, x2, y2 = table["roi"]

            normalized_tables.append({
                "id": table["id"],
                "roi": [
                    x1 / width,
                    y1 / height,
                    x2 / width,
                    y2 / height   
                ]
            })

        config = {
            "image_width": width,
            "image_height": height,
            "tables": normalized_tables
        }

        with open("vision/tables.json", "w") as file:
            json.dump(config, file, indent=4)

        print("Configuration saved!")
        break

    elif key == ord('q'):
        break

cv2.destroyAllWindows()
