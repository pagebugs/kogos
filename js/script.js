document.addEventListener("DOMContentLoaded", function() {
    // Auto-hiding header
    let lastScrollTop = 0;
    const header = document.getElementById('main-header');
    const headerHeight = header.offsetHeight;

    window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > headerHeight) {
            // Scroll Down
            header.style.top = `-${headerHeight}px`;
        } else {
            // Scroll Up
            header.style.top = '0';
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    });

    // --- Feature: 강원농협브랜치 ---
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwTrVIDuiM30oIrO_KNrsd82u4weR_ssQMKTCeN2LJnqPAE1q60-VDkGPmaxAjivGHgbg/exec';

    async function fetchBranchData() {
        try {
            const response = await fetch(GAS_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            // The API seems to return branch names in '지점명' and addresses in '주소'.
            // Let's filter by address which is more reliable.
            const gangwonBranches = data.filter(branch => branch['주소'] && branch['주소'].includes('강원'));

            populateListView(gangwonBranches);
            kakao.maps.load(() => {
                initializeMap(gangwonBranches);
            });

        } catch (error) {
            console.error("Failed to fetch branch data:", error);
            document.getElementById('feature-content').innerHTML = '<p>데이터를 불러오는 데 실패했습니다.</p>';
        }
    }

    function initializeMap(branches) {
        const mapContainer = document.getElementById('map');
        const mapOption = {
            center: new kakao.maps.LatLng(37.885, 127.729), // Default to Gangwon-do office
            level: 9
        };
        const map = new kakao.maps.Map(mapContainer, mapOption);
        const geocoder = new kakao.maps.services.Geocoder();

        branches.forEach(branch => {
            geocoder.addressSearch(branch['주소'], function(result, status) {
                if (status === kakao.maps.services.Status.OK) {
                    const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
                    new kakao.maps.Marker({
                        map: map,
                        position: coords,
                        title: branch['지점명']
                    });
                }
            });
        });
    }

    function populateListView(branches) {
        const listView = document.getElementById('list-view');
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // Create header row
        const headerRow = document.createElement('tr');
        const headers = ['지점명', '주소', '전화번호'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Create data rows
        branches.forEach(branch => {
            const row = document.createElement('tr');
            const rowData = [branch['지점명'], branch['주소'], branch['전화번호']];
            rowData.forEach(cellData => {
                const td = document.createElement('td');
                td.textContent = cellData || ''; // Handle null/undefined values
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        listView.appendChild(table);
    }

    // View Toggling
    const mapBtn = document.getElementById('map-btn');
    const listBtn = document.getElementById('list-btn');
    const mapView = document.getElementById('map');
    const listView = document.getElementById('list-view');

    mapBtn.addEventListener('click', () => {
        mapView.style.display = 'block';
        listView.style.display = 'none';
        mapBtn.classList.add('active');
        listBtn.classList.remove('active');
    });

    listBtn.addEventListener('click', () => {
        mapView.style.display = 'none';
        listView.style.display = 'block';
        listBtn.classList.add('active');
        mapBtn.classList.remove('active');
    });

    fetchBranchData();
});