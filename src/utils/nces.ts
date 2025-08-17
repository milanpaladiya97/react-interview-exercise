export interface NCESSchoolFeatureAttributes {
  NCESSCH?: string;
  LEAID?: string;
  NAME?: string;
  OPSTFIPS?: string;
  STREET?: string;
  CITY?: string;
  STATE?: string;
  ZIP?: string;
  STFIP?: string;
  CNTY?: string;
  NMCNTY?: string;
  LOCALE?: string;
  LAT?: number;
  LON?: number;
  OBJECTID?: number;
}

export interface NCESDistrictFeatureAttributes {
  OBJECTID?: number;
  LEAID?: string;
  NAME?: string;
  OPSTFIPS?: string;
  LSTREE?: string;
  LCITY?: string;
  LSTATE?: string;
  LZIP?: string;
  LZIP4?: string;
  STFIP15?: string;
  CNTY15?: string;
  NMCNTY15?: string;
  LAT1516?: number;
  LON1516?: number;
  ST?: string;
}

function normalizeSchoolAttributes(a: any, geometry?: any): NCESSchoolFeatureAttributes {
  const attrs: NCESSchoolFeatureAttributes = {};

  attrs.NAME = a.NAME || a.SCH_NAME || a.SCHOOL_NAME || a.SchoolName || a.NAME_ || "";
  attrs.STREET = a.STREET || a.MAIL_STREET || a.LSTREET1 || a.ADDRESS || a.LSTREET || "";
  attrs.CITY = a.CITY || a.MAIL_CITY || a.LCITY || a.TOWN || "";
  attrs.STATE = a.STATE || a.ST || a.MAIL_STATE || a.LSTATE || "";
  attrs.ZIP = a.ZIP || a.MAIL_ZIP || a.LZIP || a.POSTAL || a.ZIP_CODE || "";
  attrs.NCESSCH = a.NCESSCH || a.SCHID || a.NCES_ID || a.NCES || "";
  attrs.LEAID = a.LEAID || a.LEA_ID || a.LEA || "";
  attrs.OBJECTID = a.OBJECTID || a.OBJECT_ID;
  attrs.LAT = a.LAT || a.Y || a.lat || a.latitude;
  attrs.LON = a.LON || a.X || a.lon || a.longitude;

  if ((!attrs.LAT || !attrs.LON) && geometry) {
    attrs.LAT = geometry.y || attrs.LAT;
    attrs.LON = geometry.x || attrs.LON;
  }

  attrs.OPSTFIPS = a.OPSTFIPS || a.STFIP;
  attrs.CNTY = a.CNTY || a.COUNTY;
  attrs.NMCNTY = a.NMCNTY || a.COUNTYNAME;
  attrs.LOCALE = a.LOCALE;

  return attrs;
}

function normalizeDistrictAttributes(a: any): NCESDistrictFeatureAttributes {
  const attrs: NCESDistrictFeatureAttributes = {};
  
  attrs.OBJECTID = a.OBJECTID || a.OBJECT_ID;
  attrs.LEAID = a.LEAID || a.LEA_ID || a.LEA || "";
  attrs.NAME = a.DISTRICT || a.LEA_NAME || a.LEANM || `District ${a.LEAID || 'Unknown'}`;
  attrs.LSTREE = a.LSTREE || a.LSTREET || a.STREET || "";
  attrs.LCITY = a.LCITY || a.CITY || "";
  attrs.LSTATE = a.LSTATE || a.STATE || a.ST || "";
  attrs.LZIP = a.LZIP || a.ZIP || "";
  attrs.LZIP4 = a.LZIP4;
  attrs.ST = a.LSTATE || a.ST || a.STATE || a.STATE_CODE || "";
  attrs.LAT1516 = a.LAT1516 || a.LAT || a.latitude;
  attrs.LON1516 = a.LON1516 || a.LON || a.longitude;
  attrs.STFIP15 = a.STFIP15 || a.STFIP;
  attrs.CNTY15 = a.CNTY15 || a.CNTY;
  attrs.NMCNTY15 = a.NMCNTY15 || a.NMCNTY;

  return attrs;
}

export const searchSchoolDistricts = async (
  name: string,
  signal?: AbortSignal
): Promise<NCESDistrictFeatureAttributes[]> => {
  if (!name || name.trim().length < 2) {
  // Query too short, returning empty array
    return [];
  }

  try {
    const whereClause = `UPPER(NAME) LIKE UPPER('%${name.trim()}%')`;
    
    const privateSchoolEndpoint = `https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Private_School_Locations_Current/FeatureServer/0/query?where=${encodeURIComponent(whereClause)}&outFields=*&outSR=4326&f=json&resultRecordCount=500`;
    const publicSchoolEndpoint = `https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Location_201819/FeatureServer/0/query?where=${encodeURIComponent(whereClause)}&outFields=*&outSR=4326&f=json&resultRecordCount=500`;

    const [privateRes, publicRes] = await Promise.all([
      fetch(privateSchoolEndpoint, { signal }).catch((e) => {
        console.error("Private fetch error:", e);
        return { ok: false };
      }),
      fetch(publicSchoolEndpoint, { signal }).catch((e) => {
        console.error("Public fetch error:", e);
        return { ok: false };
      }),
    ]);

    const privateJson = privateRes.ok ? await (privateRes as Response).json() : { features: [] };
    const publicJson = publicRes.ok ? await (publicRes as Response).json() : { features: [] };

    const allSchools = [
      ...(Array.isArray(privateJson.features) ? privateJson.features : []),
      ...(Array.isArray(publicJson.features) ? publicJson.features : [])
    ];

    const districtMap = new Map<string, NCESDistrictFeatureAttributes>();

    allSchools.forEach((f: any) => {
      const attrs = f.attributes || f;
      const leaId = attrs.LEAID || attrs.LEA_ID || attrs.LEA;
      
      if (leaId && !districtMap.has(leaId)) {
        const district = normalizeDistrictAttributes(attrs);
        districtMap.set(leaId, district);
      }
    });

    const districts = Array.from(districtMap.values()).sort((a, b) => 
      (a.NAME || '').localeCompare(b.NAME || '')
    );

    return districts;

  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error("District search error:", err);
    }
    return [];
  }
};

export const searchSchools = async (
  name: string,
  districtLEAID?: string,
  signal?: AbortSignal
): Promise<NCESSchoolFeatureAttributes[]> => {

  try {
    const nameQuery = name.trim();
    
    let whereClause = "";
    if (nameQuery && nameQuery.length >= 2) {
      whereClause = `UPPER(NAME) LIKE UPPER('%${nameQuery}%')`;
    } else {
      whereClause = "1=1";
    }

    if (districtLEAID) {
      whereClause += ` AND LEAID = '${districtLEAID}'`;
    }

    const privateSchoolEndpoint = `https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Private_School_Locations_Current/FeatureServer/0/query?where=${encodeURIComponent(whereClause)}&outFields=*&outSR=4326&f=json&resultRecordCount=100`;
    const publicSchoolEndpoint = `https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Location_201819/FeatureServer/0/query?where=${encodeURIComponent(whereClause)}&outFields=*&outSR=4326&f=json&resultRecordCount=100`;

    const [privateRes, publicRes] = await Promise.all([
      fetch(privateSchoolEndpoint, { signal }).catch(() => ({ ok: false })),
      fetch(publicSchoolEndpoint, { signal }).catch(() => ({ ok: false })),
    ]);

    const privateJson = privateRes.ok ? await (privateRes as Response).json() : { features: [] };
    const publicJson = publicRes.ok ? await (publicRes as Response).json() : { features: [] };

    const privateFeatures = Array.isArray(privateJson.features) ? privateJson.features : [];
    const publicFeatures = Array.isArray(publicJson.features) ? publicJson.features : [];
    const combined = [...privateFeatures, ...publicFeatures];

    const normalized = combined.map((f: any) =>
      normalizeSchoolAttributes(f.attributes || f, f.geometry)
    );

    const unique = normalized.filter((school, index, self) => {
      if (school.NCESSCH) {
        return self.findIndex(s => s.NCESSCH === school.NCESSCH) === index;
      }
      return self.findIndex(s => 
        s.NAME === school.NAME && 
        s.CITY === school.CITY && 
        s.STATE === school.STATE
      ) === index;
    });
    return unique;
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error("School search error:", err);
    }
    return [];
  }
};