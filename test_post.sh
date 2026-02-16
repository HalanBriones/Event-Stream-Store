curl -v -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -d '{"eventType": "course_started", "userId": 123, "courseId": 456, "metadata": {"source": "web"}}'