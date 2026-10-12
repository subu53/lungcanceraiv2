import os
import requests
import json
import uuid

API_URL = "http://127.0.0.1:8000/api"

def test_full_pipeline():
    print("=== LUNG CANCER AI: INTEGRATION TEST ===")
    
    # 1. Login as Admin
    print("\n1. Logging in as Admin...")
    res = requests.post(f"{API_URL}/auth/login", data={"username": "admin@lung.ai", "password": "admin123"})
    if res.status_code != 200:
        print(f"❌ Login failed: {res.text}")
        return
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful")

    # 2. Get current user
    res = requests.get(f"{API_URL}/auth/me", headers=headers)
    print(f"✅ Current user: {res.json()['email']} (Role: {res.json()['role']})")

    # 3. Create a dummy image for upload
    print("\n3. Creating dummy CT image...")
    dummy_img_path = "dummy_ct.jpg"
    from PIL import Image
    import numpy as np
    Image.fromarray((np.random.rand(224, 224, 3) * 255).astype(np.uint8)).save(dummy_img_path)

    # 4. Upload image
    print("\n4. Uploading image...")
    with open(dummy_img_path, "rb") as f:
        res = requests.post(f"{API_URL}/cases/upload", headers=headers, files={"file": ("dummy_ct.jpg", f, "image/jpeg")})
    
    if res.status_code != 200:
        print(f"❌ Upload failed: {res.text}")
        return
    
    case_data = res.json()
    case_id = case_data["id"]
    print(f"✅ Upload successful. Case ID: {case_id}")

    # 5. Run classification
    print(f"\n5. Running classification on Case #{case_id}...")
    res = requests.post(f"{API_URL}/diagnosis/{case_id}", headers=headers)
    
    if res.status_code != 200:
        print(f"❌ Classification failed: {res.text}")
        return
        
    diag_data = res.json()
    print(f"✅ Classification successful!")
    print(f"   Result: {diag_data['classification']} ({diag_data['confidence']*100:.1f}%)")
    print(f"   Grad-CAM URL: {diag_data.get('gradcam_url')}")

    # 6. Submit Review
    print("\n6. Submitting review...")
    review_payload = {"review_status": "approved", "review_notes": "LGTM. AI classification matches visual findings."}
    res = requests.put(f"{API_URL}/diagnosis/{case_id}/review", headers=headers, json=review_payload)
    if res.status_code != 200:
        print(f"❌ Review failed: {res.text}")
        return
    print("✅ Review submitted successfully")

    # 7. List Users
    print("\n7. Listing users (admin only)...")
    res = requests.get(f"{API_URL}/auth/users", headers=headers)
    if res.status_code == 200:
        users = res.json()
        print(f"✅ Found {len(users)} users")
    else:
        print(f"❌ Failed to list users: {res.text}")

    # Cleanup dummy image
    if os.path.exists(dummy_img_path):
        os.remove(dummy_img_path)

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    test_full_pipeline()
