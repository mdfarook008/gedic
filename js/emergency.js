/** Public, no-login emergency profile renderer. */
const Emergency = (() => {
  let active = null;

  function setInEmergency(id, value) {
    const element = document.querySelector(`#pg-emergency [id="${id}"]`);
    if (element) element.textContent = value || "—";
  }

  function render(profile, uid) {
    const page = document.getElementById("pg-emergency");
    if (!profile) {
      page?.classList.add("profile-missing");
      setInEmergency("eN", "Emergency profile unavailable");
      return;
    }

    page?.classList.remove("profile-missing");
    active = { ...profile, uid: profile.uid || uid };
    const phone = value => value ? Phone.format(value) : "—";

    setInEmergency("eN", profile.name);
    setInEmergency("eB", profile.blood);
    setInEmergency("eAg", profile.age ? `${profile.age} yrs` : "—");
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

    const labels = {
      waDocLbl: `${profile.doctorName || "Doctor"} · ${phone(profile.doctorPhone)}`,
      waFamLbl: profile.emergencyName || "Emergency contact",
      smsDocLbl: phone(profile.doctorPhone),
      smsFamLbl: phone(profile.emergencyContact)
    };
    Object.entries(labels).forEach(([id, text]) => UI.setText(id, text));
  }

  return { render, get _active() { return active; } };
})();
