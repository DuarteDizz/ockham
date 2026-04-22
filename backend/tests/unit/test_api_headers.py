import unittest

try:
    from fastapi.testclient import TestClient

    from main import app
except Exception:  # pragma: no cover - local dev environments may miss optional deps
    TestClient = None
    app = None


@unittest.skipIf(
    TestClient is None or app is None, "FastAPI test client dependencies are not available."
)
class ApiHeaderTests(unittest.TestCase):
    def test_health_endpoint_sets_conservative_headers(self):
        client = TestClient(app)

        response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")


if __name__ == "__main__":
    unittest.main()
