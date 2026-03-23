LearnTracker — Student Analytics Platform

This is a web application built for educators and course administrators to monitor how students are progressing through online learning content. It has two main functions:

1. Event Ingestion
The system accepts learning events sent from an external platform via an API. These events capture moments like a student enrolling in a course, starting or finishing a lesson, and starting or submitting a quiz. Each event is stored with a timestamp, student ID, course ID, and lesson/quiz ID.

2. Analytics Dashboards
Once events are in the system, you can explore the data through two lenses:

Student view — See every student, which courses they're enrolled in, whether they've completed them, how long each lesson and quiz took, and how many active learning days they had.

Course view — See all courses, how many students enrolled and completed each one, completion rates, and a lesson-by-lesson breakdown of how many students started and finished each lesson and quiz on average.

3. Rushing Detection
A key feature is automatic pace classification. For each student in a course, the system flags suspicious patterns — such as finishing a lesson in under 2 minutes, submitting a quiz within 30 seconds of starting it, or completing an entire course in under 30 minutes. Students are labelled Rushing, Engaged, or Steady based on how many of these red flags are triggered.

In short, it helps educators see not just whether students completed their courses, but how they did it — and whether they were genuinely learning or rushing through.
