from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(1, 3)
    host = "http://nginx"

    @task(3)
    def load_homepage(self):
        self.client.get("/")

    @task(2)
    def get_api_data(self):
        self.client.get("/api/")

    @task(1)
    def create_item(self):
        self.client.post("/api/tasks/", json={
            "title": "Test item",
            "description": "Load testing"
        })