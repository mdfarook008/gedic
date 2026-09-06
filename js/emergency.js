/** Public, no-login emergency profile renderer. */
const Emergency = (() => {
  let active = null;
  const detailIds = [
    "eB", "eAg", "eH", "emDiseases", "emAllergies", "eMedE",
    "emFamilyName", "emFamilyPhone", "emDoctorName", "emDoctorPhone",
    "eCallFam", "eCallDoc", "eDataStatus", "eUpdatedAt"
  ];

  function setProfileActionsEnabled(enabled) {
    document.querySelectorAll("#pg-emergency [data-action='call'][data-recipient='family'], #pg-emergency [data-action='call'][data-recipient='doctor'], #pg-emergency [data-target='modWA'], #pg-emergency [data-target='modSMS']")
      .forEach(button => {
        button.disabled = !enabled;
        button.setAttribute("aria-disabled", String(!enabled));
      });
  }

  function setInEmergency(id, value) {
    const element = document.querySelector(`#pg-emergency [id="${id}"]`);
    if (element) element.textContent = value || "—";
  }

  function render(profile, uid, access = {}) {
    const page = document.getElementById("pg-emergency");
    if (!profile) {
      active = null;
      page?.classList.add("profile-missing");
      setInEmergency("eN", "Emergency profile unavailable");
      detailIds.forEach(id => setInEmergency(id, "—"));
      setInEmergency("eAccessMode", "Invalid or disabled emergency link");
      setInEmergency("eAccessTrust", "No patient data was released");
      setProfileActionsEnabled(false);
      return;
    }

    page?.classList.remove("profile-missing");
    setProfileActionsEnabled(true);
    active = { ...profile, uid: profile.uid || uid };
    const phone = value => value ? Phone.format(value) : "—";
    const updated = Number(profile.updatedAt || profile.createdAt || 0);
    const born = profile.dateOfBirth ? new Date(`${profile.dateOfBirth}T00:00:00`) : null;
    let age = profile.age || "";
    if (born && !Number.isNaN(born.getTime())) {
      const today = new Date();
      age = today.getFullYear() - born.getFullYear();
      if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age--;
    }

    setInEmergency("eN", profile.name);
    setInEmergency("eB", profile.blood);
    setInEmergency("eAg", age !== "" ? `${age} yrs` : "—");
    setInEmergency("eH", profile.hospital);
    setInEmergency("emDiseases", profile.diseases);
    setInEmergency("emAllergies", profile.allergies || "None reported");
    setInEmergency("eMedE", profile.medicines);
    setInEmergency("emFamilyName", profile.emergencyName);
    setInEmergency("emFamilyPhone", phone(profile.emergencyContact));
    setInEmergency("emDoctorName", profile.doctorName);
    setInEmergency("emDoctorPhone", phone(profile.doctorPhone));
    setInEmergency("eCallFam", `${profile.emergencyName || "Emergency contact"} · ${phone(profile.emergencyContact)}`);
    setInEmergency("eCallDoc", `${profile.doctorName || "Doctor"} · ${phone(profile.doctorPhone)}`);
    setInEmergency("eDataStatus", profile.dataStatus === "clinician-verified"
      ? "Clinician-verified record"
      : "Patient-reported · not independently verified");
    setInEmergency("eUpdatedAt", updated ? new Date(updated).toLocaleString("en-IN") : "Unknown");

    const labels = {
      waDocLbl: `${profile.doctorName || "Doctor"} · ${phone(profile.doctorPhone)}`,
      waFamLbl: profile.emergencyName || "Emergency contact",
      smsDocLbl: phone(profile.doctorPhone),
      smsFamLbl: phone(profile.emergencyContact)
    };
    Object.entries(labels).forEach(([id, text]) => UI.setText(id, text));
    const clinical = access.mode === "clinical";
    const demo = access.mode === "demo";
    setInEmergency("eAccessMode", access.mode === "biometric"
      ? "Biometric emergency match"
      : clinical ? "Authorised clinical record" : demo ? "Demonstration emergency profile" : "QR emergency link");
    setInEmergency("eAccessTrust", access.mode === "biometric"
      ? `Responder authenticated · audit ${access.auditId || "recorded"}`
      : clinical ? "Organisation-scoped staff access" : demo ? "Sample data only · no real patient record" : "Public minimum-data view");
  }

  return { render, get _active() { return active; } };
})();
