cmake_minimum_required(VERSION 3.30)

project(cad-geo)
set(CMAKE_CXX_STANDARD 17)
set(TARGET cad-geo)
set(CMAKE_CONFIGURATION_TYPES Debug;Release)
set(CMAKE_NINJA_FORCE_RESPONSE_FILE 1 CACHE INTERNAL "")

get_filename_component(SOURCE_ROOT_DIR ${CMAKE_SOURCE_DIR} DIRECTORY)
set(CMAKE_INSTALL_PREFIX "${SOURCE_ROOT_DIR}/wasm")

# OCCT Toolkits - 参考 chili3d 配置
set(OcctToolkits
    # FoundationClasses
    FoundationClasses/TKernel FoundationClasses/TKMath
    # ModelingData
    ModelingData/TKG2d ModelingData/TKG3d ModelingData/TKGeomBase ModelingData/TKBRep
    # ModelingAlgorithms
    ModelingAlgorithms/TKGeomAlgo ModelingAlgorithms/TKTopAlgo ModelingAlgorithms/TKPrim ModelingAlgorithms/TKBO ModelingAlgorithms/TKBool ModelingAlgorithms/TKHLR ModelingAlgorithms/TKFillet ModelingAlgorithms/TKOffset ModelingAlgorithms/TKFeat ModelingAlgorithms/TKMesh ModelingAlgorithms/TKShHealing
    # Visualization
    Visualization/TKService Visualization/TKV3d
    # ApplicationFramework
    ApplicationFramework/TKCDF ApplicationFramework/TKLCAF ApplicationFramework/TKCAF ApplicationFramework/TKStdL ApplicationFramework/TKStd ApplicationFramework/TKVCAF ApplicationFramework/TKBin ApplicationFramework/TKBinL
    # DataExchange
    DataExchange/TKDE DataExchange/TKXSBase DataExchange/TKXCAF DataExchange/TKDESTEP DataExchange/TKDEIGES DataExchange/TKDESTL
)

set(OcctSourceFolders)
set(OcctIncludeDirs)
foreach(toolkit ${OcctToolkits})
    include(build/occt/src/${toolkit}/PACKAGES.cmake)
    get_filename_component(toolkit_name ${toolkit} NAME)
    foreach(package ${OCCT_${toolkit_name}_LIST_OF_PACKAGES})
        if(NOT package STREQUAL "")
            list(APPEND OcctSourceFolders build/occt/src/${toolkit}/${package}/*.c*)
            list(APPEND OcctIncludeDirs build/occt/src/${toolkit}/${package})
        endif()
    endforeach()
endforeach()

include(build/occt/adm/cmake/version.cmake)
configure_file("build/occt/adm/templates/Standard_Version.hxx.in" "include/Standard_Version.hxx" @ONLY)
list(APPEND OcctIncludeDirs ${CMAKE_CURRENT_BINARY_DIR}/include)

file(GLOB OcctSourceFiles ${OcctSourceFolders})

# CadToolOnline source files
set(CadGeoSourcesFolder src)
file(GLOB_RECURSE
    CadGeoSourceFiles CONFIGURE_DEPENDS
    ${CadGeoSourcesFolder}/mbs/*.h
    ${CadGeoSourcesFolder}/mbs/*.hpp
    ${CadGeoSourcesFolder}/mbs/*.cpp
    ${CadGeoSourcesFolder}/geo/*.h
    ${CadGeoSourcesFolder}/geo/*.hpp
    ${CadGeoSourcesFolder}/geo/*.cpp
    ${CadGeoSourcesFolder}/binding/*.h
    ${CadGeoSourcesFolder}/binding/*.hpp
    ${CadGeoSourcesFolder}/binding/*.cpp
)
source_group("Sources" FILES ${CadGeoSourceFiles})
source_group("OCCT" FILES ${OcctSourceFiles})

if(${EMSCRIPTEN})

    add_library(occt STATIC ${OcctSourceFiles})
    target_include_directories(occt PUBLIC ${OcctIncludeDirs})
    target_compile_options(occt PUBLIC
        $<$<CONFIG:Release>:-Os>
        $<$<CONFIG:Release>:-flto>
        $<IF:$<CONFIG:Release>,-sDISABLE_EXCEPTION_CATCHING=1,-sDISABLE_EXCEPTION_CATCHING=0>
        -DOCCT_NO_PLUGINS
    )

    add_executable(${TARGET} ${CadGeoSourceFiles})
    target_include_directories(${TARGET} PUBLIC ${OcctIncludeDirs} ${CadGeoSourcesFolder})
    target_compile_options(${TARGET} PUBLIC
        $<$<CONFIG:Release>:-Os>
        $<$<CONFIG:Release>:-flto>
        $<IF:$<CONFIG:Release>,-sDISABLE_EXCEPTION_CATCHING=1,-sDISABLE_EXCEPTION_CATCHING=0>
    )
    target_link_libraries(${TARGET} PUBLIC occt)
    target_link_options(${TARGET} PUBLIC
        $<IF:$<CONFIG:Release>,-Os,-O0>
        $<IF:$<CONFIG:Release>,-flto,-fno-lto>
        $<IF:$<CONFIG:Release>,-sDISABLE_EXCEPTION_CATCHING=1,-sDISABLE_EXCEPTION_CATCHING=0>
        -sMODULARIZE=1
        -sEXPORT_ES6=1
        -sSTACK_SIZE=8MB
        -sINITIAL_HEAP=64MB
        -sALLOW_MEMORY_GROWTH=1
        -sMAXIMUM_MEMORY=4GB
        -sENVIRONMENT="web"
        --bind
        --emit-tsd "${TARGET}.d.ts"
    )

    install(TARGETS ${TARGET} DESTINATION ${CMAKE_INSTALL_PREFIX})
    install(FILES ${CMAKE_CURRENT_BINARY_DIR}/${TARGET}.wasm DESTINATION ${CMAKE_INSTALL_PREFIX})
    install(FILES ${CMAKE_CURRENT_BINARY_DIR}/${TARGET}.d.ts DESTINATION ${CMAKE_INSTALL_PREFIX})

endif()
