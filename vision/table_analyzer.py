
import cv2
import json
from ultralytics import YOLO

# Configuration
STREAM_URL = "http://192.168.137.105:8080/video"
CONFIG_PATH = "vision/tables.json"

# Load YOLO model
model = YOLO("yolo11n.pt")

# Load table configuration
with open(CONFIG_PATH, "r") as file:
    config = json.load(file)

tables = config["tables"]

# Connect to camera
cap = cv2.VideoCapture(STREAM_URL)

if not cap.isOpened():
    raise RuntimeError("Cannot connect to camera")


def get_table_roi(table, frame_width, frame_height):
    """Convert normalized ROI coordinates into pixels."""

    x1, y1, x2, y2 = table["roi"]

    return (
        int(x1 * frame_width),
        int(y1 * frame_height),
        int(x2 * frame_width),
        int(y2 * frame_height)
    )


def point_inside_roi(point, roi):
    """Check if a point belongs to a rectangular ROI."""

    x, y = point
    x1, y1, x2, y2 = roi

    return x1 <= x <= x2 and y1 <= y <= y2


while True:

    ret, frame = cap.read()

    if not ret:
        print("Failed to receive frame")
        continue

    height, width = frame.shape[:2]

    # Detect people
    results = model.predict(
        frame,
        classes=[0],
        conf=0.35,
        verbose=False
    )

    result = results[0]

    # Store detected people
    people = []

    for box in result.boxes:

        x1, y1, x2, y2 = box.xyxy[0].tolist()

        confidence = float(box.conf[0])

        # Bottom-center point of bounding box
        center_x = int((x1 + x2) / 2)
        bottom_y = int(y2)

        people.append({
            "point": (center_x, bottom_y),
            "confidence": confidence,
            "bbox": (int(x1), int(y1), int(x2), int(y2))
        })

    # Analyze every table
    for table in tables:

        table_id = table["id"]

        roi = get_table_roi(table, width, height)

        occupied = False

        # Check detected people
        for person in people:

            if point_inside_roi(person["point"], roi):
                occupied = True

                # Draw person bounding box
                x1, y1, x2, y2 = person["bbox"]

                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

        # Draw table ROI
        x1, y1, x2, y2 = roi

        color = (0, 0, 255) if occupied else (255, 0, 0)

        cv2.rectangle(
            frame,
            (x1, y1),
            (x2, y2),
            color,
            3
        )

        status = "OCCUPIED" if occupied else "FREE"

        cv2.putText(
            frame,
            f"Table {table_id}: {status}",
            (x1 + 10, y1 + 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            color,
            2
        )

    cv2.imshow("Table Occupancy Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
