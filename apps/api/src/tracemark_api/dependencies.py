class MockUser:
    def __init__(self, email: str = "avery@tracemark.io", user_id: str = "user_123"):
        self.email = email
        self.id = user_id

def get_current_user() -> MockUser:
    """Mock JWT auth dependency returning a mock brand owner user."""
    return MockUser()
