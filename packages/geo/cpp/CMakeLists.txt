cmake_minimum_required(VERSION 3.20)
project(chili-geo)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# OCCT version
set(OCCT_VERSION "8.0.0")

# Source files
file(GLOB_RECURSE SOURCES
    "src/mbs/*.cpp"
    "src/geo/*.cpp"
    "src/binding/*.cpp"
)

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_SOURCE_DIR}/third_party/eigen
)

if(EMSCRIPTEN)
    # OCCT WASM libraries
    set(OCCT_ROOT "${CMAKE_SOURCE_DIR}/third_party/occt-wasm")
    include_directories(${OCCT_ROOT}/include/opencascade)

    set(OCCT_LIBS
        TKernel TKMath TKG3d TKGeomBase TKBRep
        TKTopAlgo TKGeomAlgo TKPrim TKBO
        TKMesh TKSTL TKXSBase TKSTEP TKSTEPBase
        TKSTEPAttr TKIGES
    )

    link_directories(${OCCT_ROOT}/lib)

    set(CMAKE_EXECUTABLE_SUFFIX ".js")

    add_executable(chili-geo ${SOURCES})

    target_link_libraries(chili-geo ${OCCT_LIBS})

    set_target_properties(chili-geo PROPERTIES
        LINK_FLAGS "\
            -s WASM=1 \
            -s MODULARIZE=1 \
            -s EXPORT_NAME='ChiliGeo' \
            -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
            -s ALLOW_MEMORY_GROWTH=1 \
            -s MAXIMUM_MEMORY=2GB \
            -s ENVIRONMENT='web,worker' \
            --bind \
            -O3 \
            -flto \
        "
    )
else()
    # Native build for testing
    find_package(OpenCASCADE REQUIRED)
    include_directories(${OpenCASCADE_INCLUDE_DIR})

    add_library(chili-geo SHARED ${SOURCES})
    target_link_libraries(chili-geo ${OpenCASCADE_LIBRARIES})
endif()
