import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Box,
  Button,
  Center,
  Divider,
  Heading,
  HStack,
  Input,
  Select,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Card } from "@components/design/Card";
import {
  searchSchoolDistricts,
  searchSchools,
  NCESDistrictFeatureAttributes,
  NCESSchoolFeatureAttributes,
} from "@utils/nces";
import GoogleMapDisplay from "../components/maps/GoogleMapDisplay";

function useDebounce<T>(value: T, ms = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const Home: React.FC = () => {
  // Inputs
  const [districtQuery, setDistrictQuery] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");

  // Debounced inputs
  const debouncedDistrictQuery = useDebounce(districtQuery, 700);
  const debouncedSchoolQuery = useDebounce(schoolQuery, 700);

  // Results
  const [districts, setDistricts] = useState<NCESDistrictFeatureAttributes[]>([]);
  const [schools, setSchools] = useState<NCESSchoolFeatureAttributes[]>([]);

  // Selections
  const [selectedDistrict, setSelectedDistrict] = useState<NCESDistrictFeatureAttributes | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<NCESSchoolFeatureAttributes | null>(null);

  // Loading flags
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);

  // Caches
  const districtCache = useRef<Record<string, NCESDistrictFeatureAttributes[]>>({});
  const schoolCache = useRef<Record<string, NCESSchoolFeatureAttributes[]>>({});

  // Fetch districts
  useEffect(() => {
    const q = debouncedDistrictQuery.trim();

    if (!q || q.length < 2) {
      setDistricts([]);
      setSelectedDistrict(null);
      setSelectedSchool(null);
      return;
    }

    if (districtCache.current[q]) {
      setDistricts(districtCache.current[q]);
      return;
    }

    const controller = new AbortController();
    setLoadingDistricts(true);

    searchSchoolDistricts(q, controller.signal)
      .then((res) => {
        setDistricts(res);
        districtCache.current[q] = res;
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("District search error:", err);
        }
      })
      .finally(() => setLoadingDistricts(false));

    return () => controller.abort();
  }, [debouncedDistrictQuery]);

  // Fetch schools
  useEffect(() => {
    const q = debouncedSchoolQuery.trim();

    if ((!q || q.length < 2) && !selectedDistrict) {
      setSchools([]);
      setSelectedSchool(null);
      return;
    }

    const cacheKey = `${selectedDistrict?.LEAID || "all"}-${q}`;
    if (schoolCache.current[cacheKey]) {
      setSchools(schoolCache.current[cacheKey]);
      return;
    }

    const controller = new AbortController();
    setLoadingSchools(true);

    searchSchools(q || "", selectedDistrict?.LEAID, controller.signal)
      .then((res) => {
        setSchools(res);
        schoolCache.current[cacheKey] = res;

        if (selectedSchool) {
          const stillExists = res.find(s =>
            s.NCESSCH === selectedSchool.NCESSCH ||
            (s.NAME === selectedSchool.NAME && s.CITY === selectedSchool.CITY)
          );
          if (!stillExists) {
            setSelectedSchool(null);
          }
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("School search error:", err);
        }
      })
      .finally(() => setLoadingSchools(false));

    return () => controller.abort();
  }, [debouncedSchoolQuery, selectedDistrict?.LEAID, selectedSchool]);

  // Handle district selection change
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const leaId = e.target.value;

    if (!leaId) {
      setSelectedDistrict(null);
    } else {
      const match = districts.find((d) => d.LEAID === leaId) || null;
      setSelectedDistrict(match);
    }

    setSelectedSchool(null);

    // Clear schools cache for the new district to force refresh
    const currentQuery = debouncedSchoolQuery.trim();
    const newCacheKey = `${leaId || "all"}-${currentQuery}`;
    if (schoolCache.current[newCacheKey]) {
      delete schoolCache.current[newCacheKey];
    }
  };

  const districtCount = districts.length;
  const schoolCount = schools.length;
  const selectedDistrictName = selectedDistrict
    ? `${selectedDistrict.NAME} (${selectedDistrict.ST || selectedDistrict.LSTATE || ""})`
    : "—";

  const districtOptions = useMemo(
    () =>
      districts.map((d) => (
        <option key={d.LEAID || d.OBJECTID} value={d.LEAID || ""}>
          {d.NAME} ({d.ST || d.LSTATE || ""})
        </option>
      )),
    [districts]
  );


  return (
    <Center padding="64px 16px" minH="100vh">
      <Card variant="rounded" borderColor="blue">
        <Heading mb="2">School Data Finder</Heading>
        <Text fontSize="sm" color="gray.600" textAlign="center">
          Search school districts and schools using NCES/ArcGIS APIs. Select a district to filter schools (optional), then search schools and view details.
        </Text>

        <Divider my={4} />

        {/* District search */}
        <VStack spacing={3} align="stretch" w="100%">
          <Heading size="sm">1) Search Districts</Heading>
          <HStack>
            <Input
              placeholder="Type a district name (e.g., Los Angeles)"
              value={districtQuery}
              onChange={(e) => {
                setDistrictQuery(e.target.value);
              }}
            />
            {loadingDistricts && <Spinner size="sm" />}
          </HStack>
          <Box>
            <Select
              placeholder={districtCount > 0 ? "Select a district (optional)" : "No districts — refine your search"}
              value={selectedDistrict?.LEAID || ""}
              onChange={handleDistrictChange}
              disabled={districtCount === 0}
            >
              {districtOptions}
            </Select>
            <Text mt={2} fontSize="xs" color="gray.600">
              {districtCount} result{districtCount === 1 ? "" : "s"} • Selected: {selectedDistrictName}
            </Text>
          </Box>
        </VStack>

        <Divider my={4} />

        {/* School search */}
        <VStack spacing={3} align="stretch" w="100%">
          <Heading size="sm">2) Search Schools</Heading>
          <Text fontSize="xs" color="gray.600">
            {selectedDistrict
              ? `Searching within ${selectedDistrict.NAME}. Leave empty to see all schools in district.`
              : "Search for schools by name, or select a district above first."
            }
          </Text>
          <HStack>
            <Input
              placeholder="Type a school name (e.g., Lincoln, High, Elementary)"
              value={schoolQuery}
              onChange={(e) => {
                setSchoolQuery(e.target.value);
                setSelectedSchool(null);
              }}
            />
            {loadingSchools && <Spinner size="sm" />}
          </HStack>
          <Text fontSize="xs" color="gray.600">
            {selectedDistrict
              ? `Filtering by district: ${selectedDistrict.NAME}`
              : "No district filter — searching all schools"
            }
          </Text>
        </VStack>

        {/* Results */}
        <Stack direction={["column", "row"]} spacing={6} mt={6} w="100%" align="flex-start">
          {/* Schools list */}
          <VStack align="stretch" w={["100%", "50%"]} spacing={3}>
            <Heading size="sm">Schools ({schoolCount})</Heading>
            <Box borderWidth="1px" borderRadius="lg" p={3} maxH="420px" overflowY="auto" bg="gray.50">
              {loadingSchools ? (
                <HStack justifyContent="center" p={6}>
                  <Spinner color="blue.500" />
                  <Text fontSize="sm" color="gray.600">Loading schools...</Text>
                </HStack>
              ) : schools.length === 0 ? (
                <Box textAlign="center" py={8}>
                  <Text fontSize="sm" color="gray.500" mb={2}>
                    {!debouncedSchoolQuery.trim() && !selectedDistrict
                      ? "Enter a school name or select a district to search."
                      : "No schools found. Try different search terms."}
                  </Text>
                </Box>
              ) : (
                <VStack align="stretch" spacing={2}>
                  {schools.map((s, index) => (
                    <Box
                      key={s.NCESSCH || s.LEAID || s.OBJECTID || `${s.NAME}-${index}`}
                      borderWidth="1px"
                      borderRadius="md"
                      p={3}
                      cursor="pointer"
                      transition="all 0.2s"
                      bg={selectedSchool === s ? "blue.50" : "white"}
                      borderColor={selectedSchool === s ? "blue.300" : "gray.200"}
                      boxShadow={selectedSchool === s ? "md" : "sm"}
                      _hover={{
                        borderColor: selectedSchool === s ? "blue.400" : "blue.200",
                        boxShadow: "md",
                        transform: "translateY(-1px)"
                      }}
                      onClick={() => setSelectedSchool(s)}
                    >
                      <VStack align="start" spacing={1} w="100%">
                        <HStack justify="space-between" w="100%">
                          <Text
                            fontWeight={selectedSchool === s ? "semibold" : "medium"}
                            fontSize="sm"
                            color={selectedSchool === s ? "blue.700" : "gray.800"}
                            noOfLines={2}
                            flex={1}
                          >
                            {s.NAME || "(unnamed)"}
                          </Text>
                          {selectedSchool === s && (
                            <Box
                              w={2}
                              h={2}
                              borderRadius="full"
                              bg="blue.500"
                              flexShrink={0}
                            />
                          )}
                        </HStack>

                        {(s.CITY || s.STATE) && (
                          <HStack spacing={2} fontSize="xs" color="gray.500">
                            <Text>
                              {s.CITY || ""}{s.CITY && s.STATE ? ", " : ""}{s.STATE || ""}
                            </Text>
                          </HStack>
                        )}

                        {s.NCESSCH && (
                          <Text fontSize="xs" color="gray.400" fontFamily="mono">
                            ID: {s.NCESSCH}
                          </Text>
                        )}
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
          </VStack>

          {/* Details panel */}
          <VStack align="stretch" w={["100%", "50%"]} spacing={3}>
            <Heading size="sm">Details</Heading>
            <Box borderWidth="1px" borderRadius="lg" p={4} minH="200px">
              {!selectedSchool ? (
                <Text fontSize="sm" color="gray.600">Select a school from the list to see details.</Text>
              ) : (
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Text fontWeight="semibold" fontSize="lg">{selectedSchool.NAME}</Text>
                    {(selectedSchool.STREET || selectedSchool.CITY || selectedSchool.STATE || selectedSchool.ZIP) && (
                      <Text fontSize="sm" color="gray.600">
                        {[
                          selectedSchool.STREET,
                          selectedSchool.CITY,
                          `${selectedSchool.STATE || ""} ${selectedSchool.ZIP || ""}`.trim()
                        ].filter(Boolean).join(", ")}
                      </Text>
                    )}
                  </Box>

                  <Box>
                    {selectedSchool.NCESSCH && (
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="medium">NCES ID:</Text> {selectedSchool.NCESSCH}
                      </Text>
                    )}
                    {selectedSchool.LEAID && (
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="medium">District ID:</Text> {selectedSchool.LEAID}
                      </Text>
                    )}
                    {selectedDistrict && (
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="medium">District:</Text> {selectedDistrict.NAME}
                      </Text>
                    )}
                  </Box>

                  {selectedSchool && (selectedSchool.LAT && selectedSchool.LON) && (
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Location</Text>
                      <Box h="240px" borderRadius="md" overflow="hidden">
                        <GoogleMapDisplay
                          lat={selectedSchool.LAT!}
                          lng={selectedSchool.LON!}
                          markers={[{
                            id: selectedSchool.NCESSCH || selectedSchool.OBJECTID?.toString() || "school",
                            lat: selectedSchool.LAT!,
                            lng: selectedSchool.LON!,
                            label: selectedSchool.NAME || "School"
                          }]}
                        />
                      </Box>
                    </Box>
                  )}
                </VStack>
              )}
            </Box>
          </VStack>
        </Stack>
      </Card>
    </Center>
  );
};

export default Home;